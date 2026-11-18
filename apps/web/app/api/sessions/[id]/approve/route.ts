import { approveDesign, runProduction } from "@fishbelly/pipeline";
import { getDeps } from "@/lib/deps";
import { handle, readJson } from "@/lib/http";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = await readJson(req);
    const deps = getDeps();
    const approved = await approveDesign(deps, id, typeof body.versionId === "string" ? body.versionId : "");

    // Mock production takes milliseconds, so it runs inline. With real providers this
    // becomes "send an Inngest event and return": 3D generation takes minutes.
    try {
      await runProduction(deps, approved.id);
    } catch (err) {
      console.error("Production failed", err); // recorded on the job; visible in /admin
    }
    const session = await deps.store.get("sessions", id);
    return { designId: approved.id, status: session?.status ?? "failed" };
  });
}
