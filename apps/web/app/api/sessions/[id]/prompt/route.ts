import { submitPrompt } from "@fishbelly/pipeline";
import { getDeps } from "@/lib/deps";
import { handle, readJson } from "@/lib/http";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = await readJson(req);
    const version = await submitPrompt(getDeps(), id, typeof body.prompt === "string" ? body.prompt : "");
    return { version };
  });
}
