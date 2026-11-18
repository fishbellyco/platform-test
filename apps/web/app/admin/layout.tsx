import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@fishbelly/core";
import { listUserWorkspaces } from "@fishbelly/pipeline";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { getCurrentUser, signOut } from "@/lib/auth";
import { getDeps } from "@/lib/deps";

async function signOutAction() {
  "use server";
  await signOut();
  redirect("/login");
}

// Display only. Layouts don't re-run on every navigation, so they are not an access check:
// each page and server action under /admin checks the user itself.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return children;
  const workspaces = await listUserWorkspaces(getDeps(), user);

  return (
    <>
      <header className="border-b border-black/10 bg-white/60">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-5 py-3 text-sm">
          <Link href="/admin" className="font-medium uppercase tracking-[0.2em] text-neutral-500">
            Fishbelly
          </Link>
          {workspaces.length > 0 && <WorkspaceSwitcher workspaces={workspaces} />}
          {isAdmin(user) && (
            <Link href="/admin/access" className="underline">
              Access
            </Link>
          )}
          <span className="ml-auto text-neutral-500">
            {user.name} · {user.role}
          </span>
          <form action={signOutAction}>
            <button className="underline">Sign out</button>
          </form>
        </div>
      </header>
      {children}
    </>
  );
}
