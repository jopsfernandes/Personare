import fs from "node:fs";
import AdmZip from "adm-zip";
import Database from "better-sqlite3";
import { decodeFields } from "@/utils/protobuf-lite";
import { zstdDecompress } from "@/utils/zstd";

const PackageVersion = {
  Latest: 3,
  Legacy1: 1,
  Legacy2: 2,
  Unknown: 0,
} as const;
type PackageVersion = (typeof PackageVersion)[keyof typeof PackageVersion];

export interface AnkiApkgMedia {
  data: Buffer;
  filename: string;
}

export interface AnkiApkgContents {
  db: Database.Database;
  media: AnkiApkgMedia[];
}

function toPackageVersion(value: number | undefined): PackageVersion {
  switch (value) {
    case PackageVersion.Legacy1:
      return PackageVersion.Legacy1;
    case PackageVersion.Legacy2:
      return PackageVersion.Legacy2;
    case PackageVersion.Latest:
      return PackageVersion.Latest;
    default:
      return PackageVersion.Unknown;
  }
}

function readPackageVersion(zip: AdmZip): PackageVersion {
  const metaEntry = zip.getEntry("meta");

  if (!metaEntry) {
    return zip.getEntry("collection.anki21")
      ? PackageVersion.Legacy2
      : PackageVersion.Legacy1;
  }

  const fields = decodeFields(metaEntry.getData());
  const versionField = fields.get(1)?.[0];

  return toPackageVersion(
    typeof versionField === "number" ? versionField : undefined
  );
}

function collectionFileName(version: PackageVersion): string {
  if (version === PackageVersion.Legacy1) {
    return "collection.anki2";
  }

  if (version === PackageVersion.Legacy2) {
    return "collection.anki21";
  }

  return "collection.anki21b";
}

async function readCollectionDatabase(
  zip: AdmZip,
  version: PackageVersion
): Promise<Database.Database> {
  const entry = zip.getEntry(collectionFileName(version));

  if (!entry) {
    throw new Error("Arquivo .apkg inválido: banco de coleção não encontrado");
  }

  const raw = entry.getData();
  const bytes =
    version === PackageVersion.Latest ? await zstdDecompress(raw) : raw;

  return new Database(bytes);
}

function decodeMediaEntryName(entryBytes: Uint8Array): string | null {
  const fields = decodeFields(entryBytes);
  const nameField = fields.get(1)?.[0];

  return nameField instanceof Uint8Array
    ? Buffer.from(nameField).toString("utf-8")
    : null;
}

function decodeMediaEntries(buffer: Buffer): string[] {
  const fields = decodeFields(buffer);
  const entries = fields.get(1) ?? [];

  return entries.map((entry) => {
    if (!(entry instanceof Uint8Array)) {
      return "";
    }

    return decodeMediaEntryName(entry) ?? "";
  });
}

async function readMediaIndex(
  zip: AdmZip,
  version: PackageVersion
): Promise<Map<string, string>> {
  const entry = zip.getEntry("media");

  if (!entry) {
    return new Map();
  }

  const raw = entry.getData();
  const bytes =
    version === PackageVersion.Latest ? await zstdDecompress(raw) : raw;

  if (version === PackageVersion.Latest) {
    const names = decodeMediaEntries(bytes);
    return new Map(names.map((name, index) => [String(index), name]));
  }

  const map = JSON.parse(bytes.toString("utf-8")) as Record<string, string>;
  return new Map(Object.entries(map));
}

async function readMediaFiles(
  zip: AdmZip,
  version: PackageVersion,
  index: Map<string, string>
): Promise<AnkiApkgMedia[]> {
  const entries = Array.from(index)
    .map(([zipIndex, filename]) => ({
      entry: zip.getEntry(zipIndex),
      filename,
    }))
    .filter(
      (item): item is { entry: AdmZip.IZipEntry; filename: string } =>
        item.entry !== null
    );

  const media = await Promise.all(
    entries.map(async ({ entry, filename }) => {
      const raw = entry.getData();
      const data =
        version === PackageVersion.Latest ? await zstdDecompress(raw) : raw;

      return { data, filename };
    })
  );

  return media;
}

export async function parseApkg(filePath: string): Promise<AnkiApkgContents> {
  const zip = new AdmZip(fs.readFileSync(filePath));
  const version = readPackageVersion(zip);

  if (version === PackageVersion.Unknown) {
    throw new Error("Pacote .apkg de uma versão não suportada");
  }

  const db = await readCollectionDatabase(zip, version);
  const mediaIndex = await readMediaIndex(zip, version);
  const media = await readMediaFiles(zip, version, mediaIndex);

  return { db, media };
}
