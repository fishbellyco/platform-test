import { notFound } from "next/navigation";
import { isAdmin, listWorkspaces } from "@fishbelly/core";
import { listUserAccess } from "@fishbelly/pipeline";
import { requireUser } from "@/lib/auth";
import { getDeps } from "@/lib/deps";
import { addUser, saveUserAccess } from "./actions";

export const dynamic = "force-dynamic";

// Admins only: who can see which workspace.
export default async function AccessPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  if (!isAdmin(user)) notFound();
  const { error } = await searchParams;
  const rows = await listUserAccess(getDeps(), user);
  const workspaces = listWorkspaces();

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-5 py-10 text-sm">
      <section>
        <h1 className="mb-1 text-xl font-semibold">Access</h1>
        <p className="mb-6 text-neutral-600">
          Admins see every workspace. Members see only the workspaces ticked here.
        </p>
        {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-red-800">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-neutral-500">
              <tr>
                <th className="py-2 font-normal">User</th>
                <th className="font-normal">Role</th>
                {workspaces.map((w) => (
                  <th key={w.id} className="px-2 text-center font-normal">
                    {w.name}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ user: u, workspaceIds }) => {
                const formId = `access-${u.id}`;
                return (
                  <tr key={u.id} className="border-t border-black/10">
                    <td className="py-2">
                      <form id={formId} action={saveUserAccess}>
                        <input type="hidden" name="userId" value={u.id} />
                      </form>
                      <span className="font-medium">{u.name}</span>
                      <span className="ml-2 text-neutral-500">{u.email}</span>
                    </td>
                    <td>
                      <select form={formId} name="role" defaultValue={u.role} className="rounded bg-white ring-1 ring-black/10">
                        <option value="member">member</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    {workspaces.map((w) => (
                      <td key={w.id} className="px-2 text-center">
                        {u.role === "admin" ? (
                          <span className="text-neutral-400" title="Admins see every workspace">
                            all
                          </span>
                        ) : (
                          <input
                            form={formId}
                            type="checkbox"
                            name="workspace"
                            value={w.id}
                            defaultChecked={workspaceIds.includes(w.id)}
                            aria-label={`${u.name} can access ${w.name}`}
                          />
                        )}
                      </td>
                    ))}
                    <td className="text-right">
                      <button form={formId} className="rounded-lg px-3 py-1 ring-1 ring-black/20">
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Add a user</h2>
        <form action={addUser} className="flex flex-wrap gap-2">
          <input name="name" placeholder="Name" required className="rounded-lg bg-white px-3 py-2 ring-1 ring-black/10" />
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="rounded-lg bg-white px-3 py-2 ring-1 ring-black/10"
          />
          <select name="role" defaultValue="member" className="rounded-lg bg-white px-3 py-2 ring-1 ring-black/10">
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
          <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-white">Add</button>
        </form>
      </section>
    </main>
  );
}
