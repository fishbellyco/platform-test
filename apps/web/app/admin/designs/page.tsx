import Link from "next/link";
import { getDeps } from "@/lib/deps";

export const dynamic = "force-dynamic";

// Internal view. NOT PROTECTED YET: put auth in front of /admin before deploying anywhere public.
export default async function DesignsPage() {
  const sessions = (await getDeps().store.list("sessions")).reverse();
  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <h1 className="mb-6 text-xl font-semibold">Designs</h1>
      {sessions.length === 0 && <p className="text-neutral-500">Nothing yet. Make one in /studio.</p>}
      <table className="w-full text-left text-sm">
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} className="border-t border-black/10">
              <td className="py-2 font-mono text-xs">
                <Link className="underline" href={`/admin/designs/${s.id}`}>
                  {s.id}
                </Link>
              </td>
              <td>{s.templateId}</td>
              <td>{s.brandId ?? "standalone"}</td>
              <td>{s.status}</td>
              <td className="text-neutral-500">{s.createdAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
