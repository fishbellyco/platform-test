import path from "node:path";
import { buildProviders, FileAssetStorage, FileStore, type Deps } from "@fishbelly/pipeline";

let deps: Deps | null = null;

/** Server-side wiring. Local JSON + files today; Supabase later, same interfaces. */
export function getDeps(): Deps {
  if (!deps) {
    const dir = process.env.FISHBELLY_DATA_DIR ?? path.join(process.cwd(), ".data");
    deps = {
      store: new FileStore(path.join(dir, "store.json")),
      assets: new FileAssetStorage(path.join(dir, "assets"), "/api/assets"),
      providers: buildProviders(process.env),
    };
  }
  return deps;
}
