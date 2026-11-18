import { canReadAsset } from "@fishbelly/pipeline";
import { getCurrentUser } from "@/lib/auth";
import { getDeps } from "@/lib/deps";

// Serves locally stored previews and meshes. Replaced by storage URLs once on Supabase.
// Previews are public; meshes need a signed-in user with access to the design's workspace.
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params;
  const path = key.join("/");
  const deps = getDeps();
  if (!(await canReadAsset(deps, await getCurrentUser(), path))) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const asset = await deps.assets.get(path);
    return new Response(asset.content, {
      headers: {
        "content-type": asset.contentType,
        "x-content-type-options": "nosniff",
        // SVGs are served from our own origin, so make sure they can never run script.
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
        "cache-control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
