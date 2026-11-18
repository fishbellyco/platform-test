import type { User, WorkspaceMembership } from "./records";

// Who may see what. The only place these rules live: pages, server actions and route
// handlers all go through the pipeline's workspace access layer, which calls these.

/** Admins see every workspace and manage who can access which. */
export function isAdmin(user: User): boolean {
  return user.role === "admin";
}

export function canAccessWorkspace(user: User, workspaceId: string, memberships: WorkspaceMembership[]): boolean {
  if (isAdmin(user)) return true;
  return memberships.some((m) => m.userId === user.id && m.workspaceId === workspaceId);
}

/** Workspaces from `all` that this user may see, in the order given. */
export function visibleWorkspaces<W extends { id: string }>(
  user: User,
  all: W[],
  memberships: WorkspaceMembership[],
): W[] {
  return all.filter((w) => canAccessWorkspace(user, w.id, memberships));
}
