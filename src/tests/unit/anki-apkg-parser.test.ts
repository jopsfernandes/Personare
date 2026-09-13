// @vitest-environment node
// biome-ignore-all lint/suspicious/noBitwiseOperators: bitwise math is inherent to hand-encoding protobuf's varint/tag wire format for these fixtures
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { zstdCompress } from "@/utils/zstd";

/**
 * RED phase (Issue #29, Spec Driven TDD): src/main/anki-apkg-parser.ts does
 * not exist yet. Every test below is expected to fail until the Developer
 * implements parseApkg per docs/specs/issue-29-anki-apkg-parser.md AC-4.
 *
 * Fixtures are built in memory with AdmZip, matching the exact structure
 * documented in the spec (verified against ankitects/anki's own source):
 * meta (protobuf PackageMetadata, optional), collection.<ext> (SQLite,
 * optionally zstd-compressed), media (JSON or protobuf MediaEntries,
 * optionally zstd-compressed), and numbered media file entries.
 *
 * Forced to the "node" environment (see the pragma above): adm-zip's
 * central-directory scan relies on `instanceof Uint8Array` internally, and
 * under the default jsdom environment Vitest runs this file's code in a
 * separate VM realm whose Uint8Array/Buffer constructors are distinct from
 * the ones adm-zip (loaded via Node's native require) checks against, so
 * every zip it reads back comes out with zero entries. Forcing "node" keeps
 * both sides in the same realm, matching how the parser actually runs in
 * the Electron main process.
 */

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

function encodePackageMetadata(version: number): Buffer {
  return Buffer.from(encodeVarintField(1, version));
}

function encodeMediaEntry(name: string): number[] {
  return encodeLengthDelimited(1, stringBytes(name));
}

function encodeMediaEntries(names: string[]): Buffer {
  const bytes = names.flatMap((name) =>
    encodeLengthDelimited(1, encodeMediaEntry(name))
  );

  return Buffer.from(bytes);
}

function buildSqliteBuffer(): Buffer {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE col (id INTEGER PRIMARY KEY, decks TEXT)");
  db.prepare("INSERT INTO col (id, decks) VALUES (1, '{}')").run();
  const buffer = db.serialize();
  db.close();
  return buffer;
}

const MISSING_COLLECTION_MESSAGE = /banco de coleção/i;
const UNSUPPORTED_VERSION_MESSAGE = /não suportad/i;

describe("anki-apkg-parser (Issue #29)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "personare-anki-apkg-test-")
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  function writeFixture(zip: AdmZip): string {
    const filePath = path.join(tmpDir, "deck.apkg");
    zip.writeZip(filePath);
    return filePath;
  }

  it("reads a Legacy1 package (collection.anki2, no meta, JSON media map)", async () => {
    const { parseApkg } = await import("@/main/anki-apkg-parser");
    const zip = new AdmZip();
    zip.addFile("collection.anki2", buildSqliteBuffer());
    zip.addFile("media", Buffer.from(JSON.stringify({ 0: "foto.jpg" })));
    zip.addFile("0", Buffer.from("fake-image-bytes"));

    const contents = await parseApkg(writeFixture(zip));

    expect(contents.db.prepare("SELECT * FROM col").all()).toEqual([
      { decks: "{}", id: 1 },
    ]);
    expect(contents.media).toEqual([
      { data: Buffer.from("fake-image-bytes"), filename: "foto.jpg" },
    ]);
    contents.db.close();
  });

  it("reads a Legacy2 package (collection.anki21, no meta, JSON media map)", async () => {
    const { parseApkg } = await import("@/main/anki-apkg-parser");
    const zip = new AdmZip();
    zip.addFile("collection.anki21", buildSqliteBuffer());
    zip.addFile("media", Buffer.from(JSON.stringify({ 0: "audio.mp3" })));
    zip.addFile("0", Buffer.from("fake-audio-bytes"));

    const contents = await parseApkg(writeFixture(zip));

    expect(contents.db.prepare("SELECT * FROM col").all()).toEqual([
      { decks: "{}", id: 1 },
    ]);
    expect(contents.media).toEqual([
      { data: Buffer.from("fake-audio-bytes"), filename: "audio.mp3" },
    ]);
    contents.db.close();
  });

  it("reads a Latest package (collection.anki21b, zstd-compressed collection/media/files)", async () => {
    const { parseApkg } = await import("@/main/anki-apkg-parser");
    const zip = new AdmZip();
    zip.addFile("meta", encodePackageMetadata(3));
    zip.addFile("collection.anki21b", await zstdCompress(buildSqliteBuffer()));
    zip.addFile("media", await zstdCompress(encodeMediaEntries(["foto.jpg"])));
    zip.addFile("0", await zstdCompress(Buffer.from("fake-image-bytes")));

    const contents = await parseApkg(writeFixture(zip));

    expect(contents.db.prepare("SELECT * FROM col").all()).toEqual([
      { decks: "{}", id: 1 },
    ]);
    expect(contents.media).toEqual([
      { data: Buffer.from("fake-image-bytes"), filename: "foto.jpg" },
    ]);
    contents.db.close();
  });

  it("returns an empty media list when the media entry is absent", async () => {
    const { parseApkg } = await import("@/main/anki-apkg-parser");
    const zip = new AdmZip();
    zip.addFile("collection.anki21", buildSqliteBuffer());

    const contents = await parseApkg(writeFixture(zip));

    expect(contents.media).toEqual([]);
    contents.db.close();
  });

  it("silently skips a media entry whose index is missing from the zip", async () => {
    const { parseApkg } = await import("@/main/anki-apkg-parser");
    const zip = new AdmZip();
    zip.addFile("collection.anki21", buildSqliteBuffer());
    zip.addFile("media", Buffer.from(JSON.stringify({ 0: "missing.jpg" })));
    // no "0" entry in the zip

    const contents = await parseApkg(writeFixture(zip));

    expect(contents.media).toEqual([]);
    contents.db.close();
  });

  it("closes the collection database when a later step (media processing) throws", async () => {
    const { parseApkg } = await import("@/main/anki-apkg-parser");
    const zip = new AdmZip();
    zip.addFile("collection.anki21", buildSqliteBuffer());
    zip.addFile("media", Buffer.from("not valid json"));
    const fixturePath = writeFixture(zip);

    const closeSpy = vi.spyOn(Database.prototype, "close");

    await expect(parseApkg(fixturePath)).rejects.toThrow();

    expect(closeSpy).toHaveBeenCalledTimes(1);
    closeSpy.mockRestore();
  });

  it("throws when the collection database is missing", async () => {
    const { parseApkg } = await import("@/main/anki-apkg-parser");
    const zip = new AdmZip();
    zip.addFile("media", Buffer.from(JSON.stringify({})));

    await expect(parseApkg(writeFixture(zip))).rejects.toThrow(
      MISSING_COLLECTION_MESSAGE
    );
  });

  it("throws when the package version is unknown/unsupported", async () => {
    const { parseApkg } = await import("@/main/anki-apkg-parser");
    const zip = new AdmZip();
    zip.addFile("meta", encodePackageMetadata(0));
    zip.addFile("collection.anki21", buildSqliteBuffer());

    await expect(parseApkg(writeFixture(zip))).rejects.toThrow(
      UNSUPPORTED_VERSION_MESSAGE
    );
  });
});
