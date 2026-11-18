import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { User } from "@fishbelly/core";
import { PipelineError } from "@fishbelly/pipeline";
import { getDeps } from "./deps";

// Who is signed in to the internal app (/admin).
//
// DEVELOPMENT ONLY: today you sign in by picking a seeded user at /login, and the cookie holds
// a bare user id. That is not authentication. It is switched off whenever NODE_ENV is
// "production", so a deployed build has no way in until real sign-in exists.
// Next step: Supabase Auth. Replace getCurrentUser() with one that verifies the Supabase
// session and maps it to a row in `users`; nothing else needs to change, because every page,
// server action and route handler gets the user from here and the workspace rules from
// @fishbelly/pipeline's workspace access layer.

const COOKIE = "fb_dev_user";

export const devSignInEnabled = process.env.NODE_ENV !== "production";

/** First run only: an admin, a member with access to the demo workspace, and one with none. */
async function seedDevUsers(): Promise<void> {
  const { store } = getDeps();
  if ((await store.list("users")).length > 0) return;
  const createdAt = new Date().toISOString();
  const users: User[] = [
    { id: "usr_dev_admin", email: "admin@example.com", name: "Ada Admin", role: "admin", createdAt },
    { id: "usr_dev_demo", email: "demo@example.com", name: "Dan (Demo Brand)", role: "member", createdAt },
    { id: "usr_dev_new", email: "new@example.com", name: "Nina (no access yet)", role: "member", createdAt },
  ];
  for (const user of users) await store.put("users", user);
  await store.put("memberships", {
    id: "usr_dev_demo:demo",
    userId: "usr_dev_demo",
    workspaceId: "demo",
    grantedBy: "usr_dev_admin",
    createdAt,
  });
}

/** The signed-in user, or null. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  if (!devSignInEnabled) return null;
  await seedDevUsers();
  const id = (await cookies()).get(COOKIE)?.value;
  return id ? getDeps().store.get("users", id) : null;
});

/** For pages and server actions: the signed-in user, or a redirect to /login. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Users that can be picked on the dev sign-in page. */
export async function listDevUsers(): Promise<User[]> {
  if (!devSignInEnabled) return [];
  await seedDevUsers();
  return getDeps().store.list("users");
}

export async function signInAsDevUser(userId: string): Promise<boolean> {
  if (!devSignInEnabled || !(await getDeps().store.get("users", userId))) return false;
  (await cookies()).set(COOKIE, userId, { httpOnly: true, sameSite: "lax", path: "/" });
  return true;
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** Turns the access layer's 404 into Next's not-found page. Anything else is rethrown. */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof PipelineError && err.status === 404) notFound();
    throw err;
  }
}
