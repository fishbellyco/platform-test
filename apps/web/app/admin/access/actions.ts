"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { listWorkspaces, type UserRole } from "@fishbelly/core";
import {
  createUser,
  grantWorkspaceAccess,
  PipelineError,
  revokeWorkspaceAccess,
  setUserRole,
} from "@fishbelly/pipeline";
import { requireUser } from "@/lib/auth";
import { getDeps } from "@/lib/deps";

// Server actions are public endpoints: each one gets the user itself, and the pipeline's
// access functions refuse anyone who isn't an admin.

async function run(fn: () => Promise<void>): Promise<never> {
  let error: string | null = null;
  try {
    await fn();
  } catch (err) {
    if (!(err instanceof PipelineError)) throw err;
    error = err.message;
  }
  revalidatePath("/admin", "layout");
  redirect(error ? `/admin/access?error=${encodeURIComponent(error)}` : "/admin/access");
}

export async function addUser(formData: FormData) {
  const actor = await requireUser();
  await run(async () => {
    await createUser(getDeps(), actor, {
      email: String(formData.get("email") ?? ""),
      name: String(formData.get("name") ?? ""),
      role: String(formData.get("role") ?? "member") as UserRole,
    });
  });
}

/** Saves one user's row: their role and exactly the workspaces ticked. */
export async function saveUserAccess(formData: FormData) {
  const actor = await requireUser();
  const deps = getDeps();
  const userId = String(formData.get("userId") ?? "");
  const ticked = new Set(formData.getAll("workspace").map(String));
  await run(async () => {
    await setUserRole(deps, actor, userId, String(formData.get("role") ?? "member") as UserRole);
    for (const workspace of listWorkspaces()) {
      if (ticked.has(workspace.id)) await grantWorkspaceAccess(deps, actor, userId, workspace.id);
      else await revokeWorkspaceAccess(deps, actor, userId, workspace.id);
    }
  });
}
