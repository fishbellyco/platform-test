import { redirect } from "next/navigation";
import { devSignInEnabled, listDevUsers, signInAsDevUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function signIn(formData: FormData) {
  "use server";
  const ok = await signInAsDevUser(String(formData.get("userId") ?? ""));
  redirect(ok ? "/admin" : "/login");
}

export default async function LoginPage() {
  if (!devSignInEnabled) {
    return (
      <main className="mx-auto max-w-md px-5 py-16 text-sm">
        <h1 className="mb-3 text-lg font-semibold">Sign in</h1>
        <p className="text-neutral-600">Sign-in isn&apos;t set up for this deployment yet.</p>
      </main>
    );
  }
  const users = await listDevUsers();
  return (
    <main className="mx-auto max-w-md px-5 py-16 text-sm">
      <h1 className="mb-1 text-lg font-semibold">Sign in</h1>
      <p className="mb-6 text-amber-800">Development sign-in: pick a user. There are no passwords yet.</p>
      <ul className="space-y-2">
        {users.map((user) => (
          <li key={user.id}>
            <form action={signIn}>
              <input type="hidden" name="userId" value={user.id} />
              <button className="w-full rounded-xl bg-white px-4 py-3 text-left ring-1 ring-black/10 hover:ring-black/30">
                <span className="font-medium">{user.name}</span>
                <span className="ml-2 text-neutral-500">{user.email}</span>
                <span className="float-right text-neutral-500">{user.role}</span>
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
