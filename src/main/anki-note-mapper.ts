import type Database from "better-sqlite3";
import { decodeFields } from "@/utils/protobuf-lite";

const FIELD_SEPARATOR = "\x1f";
const DEFAULT_DECK_NAME = "Default";

export interface AnkiMappedFlashcard {
  back: string;
  front: string;
  mediaFilenames: string[];
}

export interface AnkiMappedDeck {
  cards: AnkiMappedFlashcard[];
  deckName: string;
}

interface AnkiTemplate {
  afmt: string;
  qfmt: string;
}

interface AnkiNotetype {
  fields: string[];
  kind: "cloze" | "standard";
  templates: AnkiTemplate[];
}

function bufferField(
  fields: Map<number, (Uint8Array | number)[]>,
  fieldNumber: number
): string {
  const value = fields.get(fieldNumber)?.[0];
  return value instanceof Uint8Array
    ? Buffer.from(value).toString("utf-8")
    : "";
}

function loadNotetypesLegacy(db: Database.Database): Map<number, AnkiNotetype> {
  const row = db.prepare("SELECT models FROM col").get() as { models: string };
  const raw = JSON.parse(row.models) as Record<
    string,
    {
      flds: { name: string; ord: number }[];
      tmpls: { afmt: string; ord: number; qfmt: string }[];
      type: number;
    }
  >;

  const notetypes = new Map<number, AnkiNotetype>();
  for (const [id, notetype] of Object.entries(raw)) {
    const fields: string[] = [];
    for (const field of notetype.flds) {
      fields[field.ord] = field.name;
    }

    const templates: AnkiTemplate[] = [];
    for (const tmpl of notetype.tmpls) {
      templates[tmpl.ord] = { afmt: tmpl.afmt, qfmt: tmpl.qfmt };
    }

    notetypes.set(Number(id), {
      fields,
      kind: notetype.type === 1 ? "cloze" : "standard",
      templates,
    });
  }

  return notetypes;
}

function loadDecksLegacy(db: Database.Database): Map<number, string> {
  const row = db.prepare("SELECT decks FROM col").get() as { decks: string };
  const raw = JSON.parse(row.decks) as Record<
    string,
    { id: number; name: string }
  >;

  return new Map(Object.values(raw).map((deck) => [deck.id, deck.name]));
}

function loadNotetypesNormalized(
  db: Database.Database
): Map<number, AnkiNotetype> {
  const fieldsByNotetype = new Map<number, string[]>();
  const fieldRows = db.prepare("SELECT ntid, ord, name FROM fields").all() as {
    name: string;
    ntid: number;
    ord: number;
  }[];
  for (const field of fieldRows) {
    const fields = fieldsByNotetype.get(field.ntid) ?? [];
    fields[field.ord] = field.name;
    fieldsByNotetype.set(field.ntid, fields);
  }

  const templatesByNotetype = new Map<number, AnkiTemplate[]>();
  const templateRows = db
    .prepare("SELECT ntid, ord, config FROM templates")
    .all() as { config: Buffer; ntid: number; ord: number }[];
  for (const tmpl of templateRows) {
    const decoded = decodeFields(tmpl.config);
    const templates = templatesByNotetype.get(tmpl.ntid) ?? [];
    templates[tmpl.ord] = {
      afmt: bufferField(decoded, 2),
      qfmt: bufferField(decoded, 1),
    };
    templatesByNotetype.set(tmpl.ntid, templates);
  }

  const notetypeRows = db.prepare("SELECT id, config FROM notetypes").all() as {
    config: Buffer;
    id: number;
  }[];

  const notetypes = new Map<number, AnkiNotetype>();
  for (const notetype of notetypeRows) {
    const decoded = decodeFields(notetype.config);
    const kindValue = decoded.get(1)?.[0];
    notetypes.set(notetype.id, {
      fields: fieldsByNotetype.get(notetype.id) ?? [],
      kind: kindValue === 1 ? "cloze" : "standard",
      templates: templatesByNotetype.get(notetype.id) ?? [],
    });
  }

  return notetypes;
}

function loadDecksNormalized(db: Database.Database): Map<number, string> {
  const rows = db.prepare("SELECT id, name FROM decks").all() as {
    id: number;
    name: string;
  }[];

  return new Map(rows.map((deck) => [deck.id, deck.name]));
}

type TemplateNode =
  | {
      children: TemplateNode[];
      field: string;
      negate: boolean;
      type: "section";
    }
  | { field: string; filters: string[]; type: "replacement" }
  | { type: "text"; value: string };

function parseTemplate(source: string): TemplateNode[] {
  const root: TemplateNode[] = [];
  const stack: Extract<TemplateNode, { type: "section" }>[] = [];
  const currentChildren = () =>
    stack.length > 0 ? (stack.at(-1)?.children ?? root) : root;

  let lastIndex = 0;
  for (const match of source.matchAll(/\{\{(.*?)\}\}/gs)) {
    const { index } = match;
    if (index > lastIndex) {
      currentChildren().push({
        type: "text",
        value: source.slice(lastIndex, index),
      });
    }
    lastIndex = index + match[0].length;

    const inner = match[1].trim();
    if (inner.startsWith("#")) {
      const node: TemplateNode = {
        children: [],
        field: inner.slice(1).trim(),
        negate: false,
        type: "section",
      };
      currentChildren().push(node);
      stack.push(node as Extract<TemplateNode, { type: "section" }>);
    } else if (inner.startsWith("^")) {
      const node: TemplateNode = {
        children: [],
        field: inner.slice(1).trim(),
        negate: true,
        type: "section",
      };
      currentChildren().push(node);
      stack.push(node as Extract<TemplateNode, { type: "section" }>);
    } else if (inner.startsWith("/")) {
      stack.pop();
    } else {
      const parts = inner.split(":").map((part) => part.trim());
      const field = parts.at(-1) ?? "";
      currentChildren().push({
        field,
        filters: parts.slice(0, -1),
        type: "replacement",
      });
    }
  }

  if (lastIndex < source.length) {
    currentChildren().push({ type: "text", value: source.slice(lastIndex) });
  }

  return root;
}

const CLOZE_PATTERN = /\{\{c(\d+(?:,\d+)*)::(.*?)(?:::(.*?))?\}\}/gs;

function clozeOrdinalsIn(text: string): Set<number> {
  const ordinals = new Set<number>();
  for (const match of text.matchAll(CLOZE_PATTERN)) {
    for (const ordinal of match[1].split(",")) {
      ordinals.add(Number(ordinal));
    }
  }
  return ordinals;
}

function renderClozeField(
  text: string,
  activeOrdinal: number,
  question: boolean
): string {
  return text.replace(CLOZE_PATTERN, (_full, ordinalsRaw, inner, hint) => {
    const isActive = ordinalsRaw.split(",").map(Number).includes(activeOrdinal);

    if (question && isActive) {
      return `[${hint ?? "..."}]`;
    }

    return inner;
  });
}

interface ClozeContext {
  ordinal: number;
  question: boolean;
}

function renderNodes(
  nodes: TemplateNode[],
  fieldValues: Map<string, string>,
  cloze: ClozeContext | undefined
): string {
  let output = "";

  for (const node of nodes) {
    if (node.type === "text") {
      output += node.value;
      continue;
    }

    if (node.type === "section") {
      const truthy = (fieldValues.get(node.field) ?? "").length > 0;
      if (node.negate ? !truthy : truthy) {
        output += renderNodes(node.children, fieldValues, cloze);
      }
      continue;
    }

    const raw = fieldValues.get(node.field) ?? "";
    output +=
      cloze && node.filters.includes("cloze")
        ? renderClozeField(raw, cloze.ordinal, cloze.question)
        : raw;
  }

  return output;
}

function renderTemplate(
  source: string,
  fieldValues: Map<string, string>,
  cloze?: ClozeContext
): string {
  return renderNodes(parseTemplate(source), fieldValues, cloze);
}

const MEDIA_PATTERN = /src=["']([^"']+)["']|\[sound:([^\]]+)\]/g;

function extractMediaFilenames(html: string): string[] {
  const filenames: string[] = [];
  for (const match of html.matchAll(MEDIA_PATTERN)) {
    const filename = match[1] ?? match[2];
    if (filename && !filenames.includes(filename)) {
      filenames.push(filename);
    }
  }
  return filenames;
}

interface CardRow {
  did: number;
  id: number;
  nid: number;
  odid: number;
  ord: number;
}

function renderCardFace(
  notetype: AnkiNotetype,
  ord: number,
  fieldValues: Map<string, string>,
  rawFields: string[]
): { back: string; front: string } | null {
  if (notetype.kind === "standard") {
    const template = notetype.templates[ord];
    if (!template) {
      return null;
    }

    const front = renderTemplate(template.qfmt, fieldValues);
    const backFields = new Map(fieldValues);
    backFields.set("FrontSide", front);

    return { back: renderTemplate(template.afmt, backFields), front };
  }

  const [template] = notetype.templates;
  if (!template) {
    return null;
  }

  const activeOrdinal = ord + 1;
  if (!clozeOrdinalsIn(rawFields.join("")).has(activeOrdinal)) {
    return null;
  }

  const front = renderTemplate(template.qfmt, fieldValues, {
    ordinal: activeOrdinal,
    question: true,
  });
  const backFields = new Map(fieldValues);
  backFields.set("FrontSide", front);
  const back = renderTemplate(template.afmt, backFields, {
    ordinal: activeOrdinal,
    question: false,
  });

  return { back, front };
}

export function mapAnkiNotesToFlashcards(
  db: Database.Database
): AnkiMappedDeck[] {
  const { ver } = db.prepare("SELECT ver FROM col").get() as { ver: number };

  let notetypes: Map<number, AnkiNotetype>;
  let deckNames: Map<number, string>;

  if (ver <= 11) {
    notetypes = loadNotetypesLegacy(db);
    deckNames = loadDecksLegacy(db);
  } else if (ver >= 15) {
    notetypes = loadNotetypesNormalized(db);
    deckNames = loadDecksNormalized(db);
  } else {
    throw new Error("Coleção Anki com schema não suportado");
  }

  const cards = db
    .prepare("SELECT id, nid, did, odid, ord FROM cards ORDER BY id")
    .all() as CardRow[];
  const noteStatement = db.prepare("SELECT flds, mid FROM notes WHERE id = ?");

  const decks = new Map<string, AnkiMappedFlashcard[]>();

  for (const card of cards) {
    const note = noteStatement.get(card.nid) as
      | { flds: string; mid: number }
      | undefined;
    if (!note) {
      continue;
    }

    const notetype = notetypes.get(note.mid);
    if (!notetype) {
      continue;
    }

    const rawFields = note.flds.split(FIELD_SEPARATOR);
    const fieldValues = new Map<string, string>();
    notetype.fields.forEach((name, index) => {
      fieldValues.set(name, rawFields[index] ?? "");
    });

    const rendered = renderCardFace(notetype, card.ord, fieldValues, rawFields);
    if (!rendered) {
      continue;
    }
    const { front, back } = rendered;

    const deckId = card.odid === 0 ? card.did : card.odid;
    const deckName = deckNames.get(deckId) ?? DEFAULT_DECK_NAME;
    const mediaFilenames = extractMediaFilenames(front + back);

    const deckCards = decks.get(deckName) ?? [];
    deckCards.push({ back, front, mediaFilenames });
    decks.set(deckName, deckCards);
  }

  return Array.from(decks, ([deckName, deckCards]) => ({
    cards: deckCards,
    deckName,
  }));
}
