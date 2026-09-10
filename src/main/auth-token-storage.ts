import fs from "node:fs";
import { safeStorage } from "electron";

export function saveToken(filePath: string, token: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    return;
  }

  fs.writeFileSync(filePath, safeStorage.encryptString(token));
}

export function loadToken(filePath: string): string | null {
  if (!(safeStorage.isEncryptionAvailable() && fs.existsSync(filePath))) {
    return null;
  }

  try {
    return safeStorage.decryptString(fs.readFileSync(filePath));
  } catch {
    return null;
  }
}

export function clearToken(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
