import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

/**
 * RED phase (Issue #30, Spec Driven TDD): src/main/anki-note-mapper.ts does
 * not exist yet. Every test below is expected to fail until the Developer
 * implements mapAnkiNotesToFlashcards per
 * docs/specs/issue-30-anki-note-mapping.md.
 *
 * Fixtures are built in memory with better-sqlite3, covering both collection
 * schemas a real .apkg can contain (verified against ankitects/anki's own
 * source for this spec): the legacy schema (col.ver <= 11, notetypes/decks
 * as JSON blobs in the `col` table) and the normalized schema (col.ver >= 15,
 * notetypes/fields/templates/decks as proper tables, `config` columns
 * protobuf-encoded) -- the same protobuf wire format already decoded by
 * src/utils/protobuf-lite.ts for Issue #29, so the encoders below mirror
 * anki-apkg-parser.test.ts's hand-rolled ones.
 */

// biome-ignore-all lint/suspicious/noBitwiseOperators: bitwise math is inherent to hand-encoding protobuf's varint/tag wire format for these fixtures
function encodeVarint(value: number): number[] {
  const bytes: number[] = [];
  let remaining = value;

  do {
    let byte = remaining & 0x7f;
    remaining >>>= 7;
    if (remaining !== 0) {
      byte |= 0x80;
    }
    bytes.push(byte);
  } while (remaining !== 0);

  return bytes;
}

function encodeTag(fieldNumber: number, wireType: number): number[] {
  return encodeVarint((fieldNumber << 3) | wireType);
}

function encodeLengthDelimited(
  fieldNumber: number,
  payload: number[]
): number[] {
  return [
    ...encodeTag(fieldNumber, 2),
    ...encodeVarint(payload.length),
    ...payload,
  ];
}

function encodeVarintField(fieldNumber: number, value: number): number[] {
  return [...encodeTag(fieldNumber, 0), ...encodeVarint(value)];
}

function stringBytes(value: string): number[] {
  return Array.from(Buffer.from(value, "utf-8"));
}

function encodeNotetypeConfig(kind: 0 | 1): Buffer {
  return Buffer.from(encodeVarintField(1, kind));
}

function encodeTemplateConfig(qfmt: string, afmt: string): Buffer {
  return Buffer.from([
    ...encodeLengthDelimited(1, stringBytes(qfmt)),
    ...encodeLengthDelimited(2, stringBytes(afmt)),
  ]);
}

const FIELD_SEPARATOR = "\x1f";

interface LegacyField {
  name: string;
  ord: number;
}

interface LegacyTemplate {
  name: string;
  ord: number;
  qfmt: string;
  afmt: string;
}

interface LegacyNotetype {
  id: number;
  type: 0 | 1;
  flds: LegacyField[];
  tmpls: LegacyTemplate[];
}

interface LegacyDeck {
  id: number;
  name: string;
}

interface NoteRow {
  id: number;
  mid: number;
  flds: string[];
}

interface CardRow {
  id: number;
  nid: number;
  did: number;
  ord: number;
  odid?: number;
}

const COL_COLUMNS =
  "id,crt,mod,scm,ver,dty,usn,ls,conf,models,decks,dconf,tags";
const NOTE_COLUMNS = "id,guid,mid,mod,usn,tags,flds,sfld,csum,flags,data";
const CARD_COLUMNS =
  "id,nid,did,ord,mod,usn,type,queue,due,ivl,factor,reps,lapses,left,odue,odid,flags,data";

function createNotesAndCardsTables(db: Database.Database): void {
  db.exec(`CREATE TABLE notes (
    id INTEGER PRIMARY KEY, guid TEXT, mid INTEGER, mod INTEGER, usn INTEGER,
    tags TEXT, flds TEXT, sfld INTEGER, csum INTEGER, flags INTEGER, data TEXT
  )`);
  db.exec(`CREATE TABLE cards (
    id INTEGER PRIMARY KEY, nid INTEGER, did INTEGER, ord INTEGER, mod INTEGER,
    usn INTEGER, type INTEGER, queue INTEGER, due INTEGER, ivl INTEGER,
    factor INTEGER, reps INTEGER, lapses INTEGER, left INTEGER, odue INTEGER,
    odid INTEGER, flags INTEGER, data TEXT
  )`);
}

function insertNotesAndCards(
  db: Database.Database,
  notes: NoteRow[],
  cards: CardRow[]
): void {
  const insertNote = db.prepare(
    `INSERT INTO notes (${NOTE_COLUMNS}) VALUES (?,?,?,0,0,'',?,0,0,0,'')`
  );
  for (const note of notes) {
    insertNote.run(
      note.id,
      `guid-${note.id}`,
      note.mid,
      note.flds.join(FIELD_SEPARATOR)
    );
  }

  const insertCard = db.prepare(
    `INSERT INTO cards (${CARD_COLUMNS}) VALUES (?,?,?,?,0,0,0,0,0,0,0,0,0,0,0,?,0,'')`
  );
  for (const card of cards) {
    insertCard.run(card.id, card.nid, card.did, card.ord, card.odid ?? 0);
  }
}

function buildLegacyDb(options: {
  notetypes: LegacyNotetype[];
  decks: LegacyDeck[];
  notes: NoteRow[];
  cards: CardRow[];
}): Database.Database {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE col (${COL_COLUMNS})`);
  createNotesAndCardsTables(db);

  const models = Object.fromEntries(
    options.notetypes.map((nt) => [
      String(nt.id),
      { flds: nt.flds, tmpls: nt.tmpls, type: nt.type },
    ])
  );
  const decks = Object.fromEntries(
    options.decks.map((deck) => [
      String(deck.id),
      { id: deck.id, name: deck.name },
    ])
  );

  db.prepare(
    `INSERT INTO col (${COL_COLUMNS}) VALUES (1,0,0,0,11,0,0,0,'{}',?,?,'{}','{}')`
  ).run(JSON.stringify(models), JSON.stringify(decks));

  insertNotesAndCards(db, options.notes, options.cards);

  return db;
}

function buildNormalizedDb(options: {
  notetypes: LegacyNotetype[];
  decks: LegacyDeck[];
  notes: NoteRow[];
  cards: CardRow[];
}): Database.Database {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE col (id INTEGER PRIMARY KEY, ver INTEGER NOT NULL)");
  db.exec(
    "CREATE TABLE notetypes (id INTEGER PRIMARY KEY, name TEXT, mtime_secs INTEGER, usn INTEGER, config BLOB)"
  );
  db.exec(
    "CREATE TABLE fields (ntid INTEGER, ord INTEGER, name TEXT, config BLOB)"
  );
  db.exec(
    "CREATE TABLE templates (ntid INTEGER, ord INTEGER, name TEXT, mtime_secs INTEGER, usn INTEGER, config BLOB)"
  );
  db.exec(
    "CREATE TABLE decks (id INTEGER PRIMARY KEY, name TEXT, mtime_secs INTEGER, usn INTEGER, common BLOB, kind BLOB)"
  );
  createNotesAndCardsTables(db);

  db.prepare("INSERT INTO col (id, ver) VALUES (1, 18)").run();

  const insertNotetype = db.prepare(
    "INSERT INTO notetypes (id, name, mtime_secs, usn, config) VALUES (?, '', 0, 0, ?)"
  );
  const insertField = db.prepare(
    "INSERT INTO fields (ntid, ord, name, config) VALUES (?, ?, ?, X'')"
  );
  const insertTemplate = db.prepare(
    "INSERT INTO templates (ntid, ord, name, mtime_secs, usn, config) VALUES (?, ?, '', 0, 0, ?)"
  );
  for (const nt of options.notetypes) {
    insertNotetype.run(nt.id, encodeNotetypeConfig(nt.type));
    for (const field of nt.flds) {
      insertField.run(nt.id, field.ord, field.name);
    }
    for (const tmpl of nt.tmpls) {
      insertTemplate.run(
        nt.id,
        tmpl.ord,
        encodeTemplateConfig(tmpl.qfmt, tmpl.afmt)
      );
    }
  }

  const insertDeck = db.prepare(
    "INSERT INTO decks (id, name, mtime_secs, usn, common, kind) VALUES (?, ?, 0, 0, X'', X'')"
  );
  for (const deck of options.decks) {
    insertDeck.run(deck.id, deck.name);
  }

  insertNotesAndCards(db, options.notes, options.cards);

  return db;
}

const BASIC_NOTETYPE: LegacyNotetype = {
  flds: [
    { name: "Front", ord: 0 },
    { name: "Back", ord: 1 },
  ],
  id: 1,
  tmpls: [
    {
      afmt: "{{FrontSide}}<hr>{{Back}}",
      name: "Card 1",
      ord: 0,
      qfmt: "{{Front}}",
    },
  ],
  type: 0,
};

describe.each([
  { build: buildLegacyDb, label: "legacy schema (col.models/col.decks JSON)" },
  {
    build: buildNormalizedDb,
    label: "normalized schema (notetypes/fields/templates/decks tables)",
  },
])("anki-note-mapper (Issue #30) -- $label", ({ build }) => {
  it("maps a standard front/back note type into a Flashcard per deck", async () => {
    const { mapAnkiNotesToFlashcards } = await import(
      "@/main/anki-note-mapper"
    );
    const db = build({
      cards: [{ did: 1, id: 1000, nid: 100, ord: 0 }],
      decks: [{ id: 1, name: "Deck Padrão" }],
      notes: [{ flds: ["Pergunta", "Resposta"], id: 100, mid: 1 }],
      notetypes: [BASIC_NOTETYPE],
    });

    expect(mapAnkiNotesToFlashcards(db)).toEqual([
      {
        cards: [
          { back: "Pergunta<hr>Resposta", front: "Pergunta", mediaFilenames: [] },
        ],
        deckName: "Deck Padrão",
      },
    ]);

    db.close();
  });

  it("renders a conditional section only when its field is non-empty", async () => {
    const { mapAnkiNotesToFlashcards } = await import(
      "@/main/anki-note-mapper"
    );
    const notetype: LegacyNotetype = {
      flds: [
        { name: "Front", ord: 0 },
        { name: "Back", ord: 1 },
        { name: "Extra", ord: 2 },
      ],
      id: 2,
      tmpls: [
        {
          afmt: "{{FrontSide}}<hr>{{Back}}{{#Extra}}<div>{{Extra}}</div>{{/Extra}}",
          name: "Card 1",
          ord: 0,
          qfmt: "{{Front}}",
        },
      ],
      type: 0,
    };
    const db = build({
      cards: [
        { did: 1, id: 1, nid: 1, ord: 0 },
        { did: 1, id: 2, nid: 2, ord: 0 },
      ],
      decks: [{ id: 1, name: "Deck" }],
      notes: [
        { flds: ["Q1", "A1", ""], id: 1, mid: 2 },
        { flds: ["Q2", "A2", "info extra"], id: 2, mid: 2 },
      ],
      notetypes: [notetype],
    });

    const [{ cards }] = mapAnkiNotesToFlashcards(db);

    expect(cards[0]).toEqual({ back: "Q1<hr>A1", front: "Q1", mediaFilenames: [] });
    expect(cards[1]).toEqual({
      back: "Q2<hr>A2<div>info extra</div>",
      front: "Q2",
      mediaFilenames: [],
    });

    db.close();
  });

  it("generates one card per cloze ordinal, masking only the active number", async () => {
    const { mapAnkiNotesToFlashcards } = await import(
      "@/main/anki-note-mapper"
    );
    const clozeNotetype: LegacyNotetype = {
      flds: [
        { name: "Text", ord: 0 },
        { name: "Extra", ord: 1 },
      ],
      id: 3,
      tmpls: [
        { afmt: "{{cloze:Text}}<br>{{Extra}}", name: "Cloze", ord: 0, qfmt: "{{cloze:Text}}" },
      ],
      type: 1,
    };
    const db = build({
      cards: [
        { did: 1, id: 1, nid: 1, ord: 0 },
        { did: 1, id: 2, nid: 1, ord: 1 },
      ],
      decks: [{ id: 1, name: "Deck" }],
      notes: [
        {
          flds: [
            "A capital da França é {{c1::Paris}} e o rio é {{c2::Sena}}.",
            "Info extra",
          ],
          id: 1,
          mid: 3,
        },
      ],
      notetypes: [clozeNotetype],
    });

    const [{ cards }] = mapAnkiNotesToFlashcards(db);

    expect(cards).toEqual([
      {
        back: "A capital da França é Paris e o rio é Sena.<br>Info extra",
        front: "A capital da França é [...] e o rio é Sena.",
        mediaFilenames: [],
      },
      {
        back: "A capital da França é Paris e o rio é Sena.<br>Info extra",
        front: "A capital da França é Paris e o rio é [...].",
        mediaFilenames: [],
      },
    ]);

    db.close();
  });

  it("skips a cloze card whose ordinal is no longer present in any field", async () => {
    const { mapAnkiNotesToFlashcards } = await import(
      "@/main/anki-note-mapper"
    );
    const clozeNotetype: LegacyNotetype = {
      flds: [{ name: "Text", ord: 0 }],
      id: 4,
      tmpls: [{ afmt: "{{cloze:Text}}", name: "Cloze", ord: 0, qfmt: "{{cloze:Text}}" }],
      type: 1,
    };
    const db = build({
      cards: [
        { did: 1, id: 1, nid: 1, ord: 0 },
        { did: 1, id: 2, nid: 1, ord: 2 },
      ],
      decks: [{ id: 1, name: "Deck" }],
      notes: [{ flds: ["Só {{c1::um}} cloze aqui."], id: 1, mid: 4 }],
      notetypes: [clozeNotetype],
    });

    const [{ cards }] = mapAnkiNotesToFlashcards(db);

    expect(cards).toHaveLength(1);

    db.close();
  });

  it("skips a standard card whose ord exceeds the note type's templates", async () => {
    const { mapAnkiNotesToFlashcards } = await import(
      "@/main/anki-note-mapper"
    );
    const db = build({
      cards: [{ did: 1, id: 1, nid: 100, ord: 5 }],
      decks: [{ id: 1, name: "Deck" }],
      notes: [{ flds: ["Pergunta", "Resposta"], id: 100, mid: 1 }],
      notetypes: [BASIC_NOTETYPE],
    });

    expect(mapAnkiNotesToFlashcards(db)).toEqual([]);

    db.close();
  });

  it("groups by the effective deck: odid (filtered deck) wins over did when set", async () => {
    const { mapAnkiNotesToFlashcards } = await import(
      "@/main/anki-note-mapper"
    );
    const db = build({
      cards: [
        { did: 999, id: 1, nid: 100, odid: 1, ord: 0 },
        { did: 1, id: 2, nid: 101, ord: 0 },
      ],
      decks: [{ id: 1, name: "Deck A" }],
      notes: [
        { flds: ["Q1", "A1"], id: 100, mid: 1 },
        { flds: ["Q2", "A2"], id: 101, mid: 1 },
      ],
      notetypes: [BASIC_NOTETYPE],
    });

    const result = mapAnkiNotesToFlashcards(db);

    expect(result).toHaveLength(1);
    expect(result[0].deckName).toBe("Deck A");
    expect(result[0].cards).toHaveLength(2);

    db.close();
  });

  it("falls back to 'Default' for a card whose deck id isn't in the deck index", async () => {
    const { mapAnkiNotesToFlashcards } = await import(
      "@/main/anki-note-mapper"
    );
    const db = build({
      cards: [{ did: 404, id: 1, nid: 100, ord: 0 }],
      decks: [],
      notes: [{ flds: ["Q1", "A1"], id: 100, mid: 1 }],
      notetypes: [BASIC_NOTETYPE],
    });

    const result = mapAnkiNotesToFlashcards(db);

    expect(result[0].deckName).toBe("Default");

    db.close();
  });

  it("extracts referenced media filenames from front/back, deduplicated in order", async () => {
    const { mapAnkiNotesToFlashcards } = await import(
      "@/main/anki-note-mapper"
    );
    const notetype: LegacyNotetype = {
      flds: [
        { name: "Front", ord: 0 },
        { name: "Back", ord: 1 },
      ],
      id: 5,
      tmpls: [
        {
          afmt: "{{FrontSide}}<hr>{{Back}}",
          name: "Card 1",
          ord: 0,
          qfmt: "{{Front}}",
        },
      ],
      type: 0,
    };
    const db = build({
      cards: [{ did: 1, id: 1, nid: 1, ord: 0 }],
      decks: [{ id: 1, name: "Deck" }],
      notes: [
        {
          flds: [
            '<img src="foto.jpg">Pergunta',
            'Resposta [sound:audio.mp3] <img src="foto.jpg">',
          ],
          id: 1,
          mid: 5,
        },
      ],
      notetypes: [notetype],
    });

    const [{ cards }] = mapAnkiNotesToFlashcards(db);

    expect(cards[0].mediaFilenames).toEqual(["foto.jpg", "audio.mp3"]);

    db.close();
  });
});

describe("anki-note-mapper (Issue #30) -- schema detection", () => {
  it("throws when the collection schema version is neither legacy nor normalized", async () => {
    const { mapAnkiNotesToFlashcards } = await import(
      "@/main/anki-note-mapper"
    );
    const db = new Database(":memory:");
    db.exec("CREATE TABLE col (id INTEGER PRIMARY KEY, ver INTEGER NOT NULL)");
    db.prepare("INSERT INTO col (id, ver) VALUES (1, 14)").run();

    expect(() => mapAnkiNotesToFlashcards(db)).toThrow(/não suportad/i);

    db.close();
  });
});
