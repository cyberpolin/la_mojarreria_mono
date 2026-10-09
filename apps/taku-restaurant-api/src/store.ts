import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { Database } from "./types.js";

function now() {
  return new Date().toISOString();
}

export function id(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

const emptyDatabase = (): Database => ({
  restaurants: [],
  users: [],
  expenses: [],
  refreshTokens: [],
});

export class JsonStore {
  constructor(private readonly filePath: string) {}

  async read(): Promise<Database> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<Database>;
      return {
        restaurants: parsed.restaurants ?? [],
        users: parsed.users ?? [],
        expenses: parsed.expenses ?? [],
        refreshTokens: parsed.refreshTokens ?? [],
      };
    } catch {
      return emptyDatabase();
    }
  }

  async update<T>(mutator: (database: Database) => T | Promise<T>) {
    const database = await this.read();
    const result = await mutator(database);
    await mkdir(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${randomUUID()}.tmp`;
    await writeFile(tempPath, JSON.stringify(database, null, 2), "utf8");
    await rename(tempPath, this.filePath);
    return result;
  }
}

export { now };
