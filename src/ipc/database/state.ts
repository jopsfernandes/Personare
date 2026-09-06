import type { DatabaseClient } from "@/database/client";

let databaseClient: DatabaseClient | undefined;

export function setDatabaseClient(client: DatabaseClient) {
  databaseClient = client;
}

export function getDatabaseClient() {
  return databaseClient;
}
