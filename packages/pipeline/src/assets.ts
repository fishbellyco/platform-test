import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface StoredAsset {
  content: string;
  contentType: string;
}

/** File storage for previews and meshes. Swap in Supabase Storage / S3 by implementing this. */
export interface AssetStorage {
  /** Saves the content and returns the URL the browser can load it from. */
  put(key: string, content: string): Promise<string>;
  get(key: string): Promise<StoredAsset>;
}

const TYPES: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".stl": "model/stl",
};

function checkKey(key: string): void {
  if (!/^[A-Za-z0-9_\-/.]+$/.test(key) || key.includes("..") || key.startsWith("/")) {
    throw new Error("Invalid asset key.");
  }
}
const typeOf = (key: string) => TYPES[path.extname(key)] ?? "application/octet-stream";

export class MemoryAssetStorage implements AssetStorage {
  private files = new Map<string, string>();
  async put(key: string, content: string): Promise<string> {
    checkKey(key);
    this.files.set(key, content);
    return `memory://${key}`;
  }
  async get(key: string): Promise<StoredAsset> {
    const content = this.files.get(key);
    if (content === undefined) throw new Error(`No asset at ${key}`);
    return { content, contentType: typeOf(key) };
  }
}

export class FileAssetStorage implements AssetStorage {
  constructor(
    private readonly dir: string,
    private readonly urlPrefix: string,
  ) {}
  async put(key: string, content: string): Promise<string> {
    checkKey(key);
    const file = path.join(this.dir, key);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
    return `${this.urlPrefix}/${key}`;
  }
  async get(key: string): Promise<StoredAsset> {
    checkKey(key);
    return { content: readFileSync(path.join(this.dir, key), "utf8"), contentType: typeOf(key) };
  }
}
