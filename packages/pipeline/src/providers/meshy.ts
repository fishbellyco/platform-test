import type { ModelGenerator } from "./types";

/**
 * Placeholder for the Meshy adapter. Not implemented on purpose: the endpoints and
 * options should be taken from Meshy's current API docs and from the settings used
 * in the Weavy flow, not guessed.
 *
 * What it has to do:
 *  1. Submit `imageUrl` (the manufacturing reference, or the approved preview) with `prompt` as an
 *     image-to-3D task (Meshy V6 in the Weavy flow). Meshy fetches the image itself, so it needs a
 *     short-lived signed URL: these files are private to the workspace.
 *  2. Wait for the result by webhook or polling. This is the long step, so it belongs
 *     in a durable workflow (Inngest) rather than a web request.
 *  3. Download the mesh and hand it on. Expect no reliable scale or wall thickness:
 *     the geometry step scales it, merges the fixed base and measures it.
 */
export function meshyModel(_apiKey: string): ModelGenerator {
  return {
    name: "meshy",
    async generate() {
      throw new Error("Meshy adapter is not implemented yet. See providers/meshy.ts.");
    },
  };
}
