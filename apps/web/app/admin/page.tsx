import { redirect } from "next/navigation";
import { listUserWorkspaces } from "@fishbelly/pipeline";
import { requireUser } from "@/lib/auth";
import { getDeps } from "@/lib/deps";

export const dynamic = "force-dynamic";

// Lands on the first workspace this user can see.
export default async function AdminHome() {
  const user = await requireUser();
  const [first] = await listUserWorkspaces(getDeps(), user);
  if (first) redirect(`/admin/${first.id}`);
  return (
    <main className="mx-auto max-w-5xl px-5 py-10 text-sm">
      <p className="text-neutral-600">You don&apos;t have access to any workspaces yet. Ask an admin to add you.</p>
    </main>
  );
}
