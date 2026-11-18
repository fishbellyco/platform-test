import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  ApprovedDesign,
  DesignSession,
  DesignVersion,
  GenerationJob,
  ManufacturingAsset,
  User,
  WorkspaceMembership,
} from "@fishbelly/core";

export interface Tables {
  sessions: DesignSession;
  versions: DesignVersion;
  approved: ApprovedDesign;
  jobs: GenerationJob;
  assets: ManufacturingAsset;
  users: User;
  memberships: WorkspaceMembership;
}
type Table = keyof Tables;
type Data = { [K in Table]: Record<string, Tables[K]> };

/** Everything the pipeline needs from a database. Swap in Postgres by implementing this. */
export interface Store {
  get<K extends Table>(table: K, id: string): Promise<Tables[K] | null>;
  /** Create or update. Refuses to overwrite an approved design. */
  put<K extends Table>(table: K, row: Tables[K]): Promise<void>;
  /** Rows in insertion order, optionally filtered by exact field matches. */
  list<K extends Table>(table: K, where?: Partial<Tables[K]>): Promise<Tables[K][]>;
  /** Removes a row if present. Refuses to delete an approved design. */
  delete(table: Table, id: string): Promise<void>;
}

const empty = (): Data => ({
  sessions: {},
  versions: {},
  approved: {},
  jobs: {},
  assets: {},
  users: {},
  memberships: {},
});

abstract class BaseStore implements Store {
  protected abstract read(): Data;
  protected abstract write(data: Data): void;

  async get<K extends Table>(table: K, id: string): Promise<Tables[K] | null> {
    return (this.read()[table] as Record<string, Tables[K]>)[id] ?? null;
  }

  async put<K extends Table>(table: K, row: Tables[K]): Promise<void> {
    const data = this.read();
    const rows = data[table] as Record<string, Tables[K]>;
    if (table === "approved" && rows[row.id]) {
      throw new Error(`Approved design ${row.id} is immutable.`);
    }
    rows[row.id] = JSON.parse(JSON.stringify(row)) as Tables[K];
    this.write(data);
  }

  async list<K extends Table>(table: K, where: Partial<Tables[K]> = {}): Promise<Tables[K][]> {
    const rows = Object.values(this.read()[table] as Record<string, Tables[K]>);
    const filters = Object.entries(where) as [keyof Tables[K], unknown][];
    return rows.filter((row) => filters.every(([key, value]) => row[key] === value));
  }

  async delete(table: Table, id: string): Promise<void> {
    if (table === "approved") throw new Error(`Approved design ${id} is immutable.`);
    const data = this.read();
    delete (data[table] as Record<string, unknown>)[id];
    this.write(data);
  }
}

/** For tests and the terminal demo. */
export class MemoryStore extends BaseStore {
  private data = empty();
  protected read(): Data {
    return this.data;
  }
  protected write(data: Data): void {
    this.data = data;
  }
}

/** Local development only: one JSON file, no setup. Not safe for concurrent writers. */
export class FileStore extends BaseStore {
  constructor(private readonly file: string) {
    super();
  }
  protected read(): Data {
    if (!existsSync(this.file)) return empty();
    return { ...empty(), ...(JSON.parse(readFileSync(this.file, "utf8")) as Partial<Data>) };
  }
  protected write(data: Data): void {
    mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2));
    renameSync(tmp, this.file);
  }
}
