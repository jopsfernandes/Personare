import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

const MAGIC = Buffer.from("PSNRBKP1", "utf-8");
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, KEY_LENGTH);
}

export function encryptBackup(plaintext: string, passphrase: string): Buffer {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([MAGIC, salt, iv, authTag, ciphertext]);
}

export function decryptBackup(buffer: Buffer, passphrase: string): string {
  const headerLength = MAGIC.length + SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;

  if (
    buffer.length < headerLength ||
    !buffer.subarray(0, MAGIC.length).equals(MAGIC)
  ) {
    throw new Error("Invalid passphrase or corrupted backup file");
  }

  let offset = MAGIC.length;
  const salt = buffer.subarray(offset, offset + SALT_LENGTH);
  offset += SALT_LENGTH;
  const iv = buffer.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;
  const authTag = buffer.subarray(offset, offset + AUTH_TAG_LENGTH);
  offset += AUTH_TAG_LENGTH;
  const ciphertext = buffer.subarray(offset);

  try {
    const key = deriveKey(passphrase, salt);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf-8");
  } catch (cause) {
    throw new Error("Invalid passphrase or corrupted backup file", { cause });
  }
}
