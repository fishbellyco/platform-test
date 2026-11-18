import { createSession } from "@fishbelly/pipeline";
import { getDeps } from "@/lib/deps";
import { handle, readJson } from "@/lib/http";

// TODO (Phase 6): rate-limit session creation per IP / brand.
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const session = await createSession(getDeps(), {
      templateId: typeof body.templateId === "string" ? body.templateId : "",
      brandId: typeof body.brandId === "string" ? body.brandId : "",
    });
    return { session };
  });
}
