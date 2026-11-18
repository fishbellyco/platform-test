import Link from "next/link";
import { getTemplate, listBrands } from "@fishbelly/core";
import { listWorkspaceSessions, requireWorkspace } from "@fishbelly/pipeline";
import { orNotFound, requireUser } from "@/lib/auth";
import { getDeps } from "@/lib/deps";

export const dynamic = "force-dynamic";

// Every design in one workspace. Other workspaces' designs never reach this page.
export default async function WorkspacePage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: workspaceId } = await params;
  const user = await requireUser();
  const deps = getDeps();
  const workspace = await orNotFound(requireWorkspace(deps, user, workspaceId));
  const sessions = await orNotFound(listWorkspaceSessions(deps, user, workspace.id));
  const brands = listBrands(workspace.id);
  const products = [...new Set(brands.flatMap((b) => b.templateIds))].map((id) => getTemplate(id)?.name ?? id);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 text-sm">
      <h1 className="text-xl font-semibold">{workspace.name}</h1>
      <p className="mb-8 text-neutral-600">
        Brands: {brands.map((b) => b.name).join(", ") || "none"} · Products: {products.join(", ") || "none"}
      </p>
      <h2 className="mb-3 font-semibold">Designs</h2>
      {sessions.length === 0 && <p className="text-neutral-500">No designs in this workspace yet.</p>}
      <table className="w-full text-left">
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} className="border-t border-black/10">
              <td className="py-2 font-mono text-xs">
                <Link className="underline" href={`/admin/${workspace.id}/designs/${s.id}`}>
                  {s.id}
                </Link>
              </td>
              <td>{s.templateId}</td>
              <td>{s.brandId}</td>
              <td>{s.status}</td>
              <td className="text-neutral-500">{s.createdAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
