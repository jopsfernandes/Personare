import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { database } from "@/ipc/database";

const DATABASE_NAMESPACE_PATTERN = /\bdatabase\b/;

describe("database IPC namespace", () => {
  it("exposes a getDatabaseStatus procedure to the renderer", () => {
    expect(database.getDatabaseStatus).toBeDefined();
  });

  it("is registered on the root oRPC router in src/ipc/router.ts", () => {
    const routerSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/ipc/router.ts"),
      "utf-8"
    );

    expect(routerSource).toMatch(DATABASE_NAMESPACE_PATTERN);
  });
});
