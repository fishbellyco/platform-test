import { randomUUID } from "node:crypto";
import {
  canAccessWorkspace,
  getWorkspace,
  isAdmin,
  listWorkspaces,
  visibleWorkspaces,
  type ApprovedDesign,
  type DesignSession,
  type DesignVersion,
  type GenerationJob,
  type ManufacturingAsset,
  type User,
  type UserRole,
  type Workspace,
  type WorkspaceMembership,
} from "@fishbelly/core";
import { PipelineError, type Deps } from "./pipeline";

// The workspace access layer. Everything the internal app (/admin) reads or changes goes
// through these functions, and each one checks the signed-in user first. Pages, server
// actions and route handlers must not read tenant data from the store directly.
//
// "Not found" and "no access" give the same 404, so workspace and design ids don't leak.

const NOT_FOUND = "Not found.";
const now = () => new Date().toISOString();

async function membershipsOf(deps: Deps, user: User): Promise<WorkspaceMembership[]> {
  return isAdmin(user) ? [] : deps.store.list("memberships", { userId: user.id });
}

function requireAdmin(actor: User): void {
  if (!isAdmin(actor)) throw new PipelineError("Only admins can manage access.", 403);
}

/** The workspaces this user may switch between. */
export async function listUserWorkspaces(deps: Deps, user: User): Promise<Workspace[]> {
  return visibleWorkspaces(user, listWorkspaces(), await membershipsOf(deps, user));
}

/** The workspace, if it exists and this user may see it. Otherwise a 404. */
export async function requireWorkspace(deps: Deps, user: User, workspaceId: string): Promise<Workspace> {
  const workspace = getWorkspace(workspaceId);
  if (!workspace || !canAccessWorkspace(user, workspace.id, await membershipsOf(deps, user))) {
    throw new PipelineError(NOT_FOUND, 404);
  }
  return workspace;
}

/** Design sessions in one workspace, newest first. */
export async function listWorkspaceSessions(deps: Deps, user: User, workspaceId: string): Promise<DesignSession[]> {
  const workspace = await requireWorkspace(deps, user, workspaceId);
  return (await deps.store.list("sessions", { workspaceId: workspace.id })).reverse();
}

export interface DesignRecord {
  session: DesignSession;
  versions: DesignVersion[];
  jobs: GenerationJob[];
  approved: ApprovedDesign[];
  assets: ManufacturingAsset[];
}

/** One design and everything it produced, only if it belongs to this workspace. */
export async function getWorkspaceDesign(
  deps: Deps,
  user: User,
  workspaceId: string,
  sessionId: string,
): Promise<DesignRecord> {
  const workspace = await requireWorkspace(deps, user, workspaceId);
  const session = await deps.store.get("sessions", sessionId);
  if (!session || session.workspaceId !== workspace.id) throw new PipelineError(NOT_FOUND, 404);
  const [versions, jobs, approved, assets] = await Promise.all([
    deps.store.list("versions", { sessionId }),
    deps.store.list("jobs", { sessionId }),
    deps.store.list("approved", { sessionId }),
    deps.store.list("assets", { sessionId }),
  ]);
  return { session, versions, jobs, approved, assets };
}

/**
 * Who may fetch a stored file. Previews are shown to customers (studio, embed and the
 * brand's own page), so they are public by unguessable URL. Meshes and manufacturing references
 * are production files: only users with access to the design's workspace. Anything else is refused.
 */
export async function canReadAsset(deps: Deps, user: User | null, key: string): Promise<boolean> {
  if (/^previews\/ses_[0-9a-f-]+\/\d+\.(svg|png)$/.test(key)) return true;
  const internal = /^(?:models\/(des_[0-9a-f-]+)\.stl|manufacturing\/(des_[0-9a-f-]+)\.(?:svg|png))$/.exec(key);
  if (!internal || !user) return false;
  const approved = await deps.store.get("approved", (internal[1] ?? internal[2])!);
  const session = approved && (await deps.store.get("sessions", approved.sessionId));
  if (!session) return false;
  return canAccessWorkspace(user, session.workspaceId, await membershipsOf(deps, user));
}

// ---- Access management (admins only) ----

export interface UserAccess {
  user: User;
  /** Workspace ids this user has been given. Admins see everything regardless. */
  workspaceIds: string[];
}

export async function listUserAccess(deps: Deps, actor: User): Promise<UserAccess[]> {
  requireAdmin(actor);
  const [users, memberships] = await Promise.all([deps.store.list("users"), deps.store.list("memberships")]);
  return users.map((user) => ({
    user,
    workspaceIds: memberships.filter((m) => m.userId === user.id).map((m) => m.workspaceId),
  }));
}

export async function createUser(
  deps: Deps,
  actor: User,
  input: { email: string; name: string; role: UserRole },
): Promise<User> {
  requireAdmin(actor);
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PipelineError("Enter a valid email address.");
  if (!name) throw new PipelineError("Enter a name.");
  if (input.role !== "admin" && input.role !== "member") throw new PipelineError("Unknown role.");
  if ((await deps.store.list("users")).some((u) => u.email === email)) {
    throw new PipelineError("A user with that email already exists.", 409);
  }
  const user: User = { id: `usr_${randomUUID()}`, email, name: name.slice(0, 100), role: input.role, createdAt: now() };
  await deps.store.put("users", user);
  return user;
}

export async function setUserRole(deps: Deps, actor: User, userId: string, role: UserRole): Promise<void> {
  requireAdmin(actor);
  if (role !== "admin" && role !== "member") throw new PipelineError("Unknown role.");
  const user = await deps.store.get("users", userId);
  if (!user) throw new PipelineError("User not found.", 404);
  if (user.role === "admin" && role === "member") {
    const admins = (await deps.store.list("users")).filter((u) => u.role === "admin");
    if (admins.length <= 1) throw new PipelineError("There must always be at least one admin.", 409);
  }
  await deps.store.put("users", { ...user, role });
}

export async function grantWorkspaceAccess(deps: Deps, actor: User, userId: string, workspaceId: string): Promise<void> {
  requireAdmin(actor);
  if (!(await deps.store.get("users", userId))) throw new PipelineError("User not found.", 404);
  if (!getWorkspace(workspaceId)) throw new PipelineError("Workspace not found.", 404);
  const id = `${userId}:${workspaceId}`;
  if (await deps.store.get("memberships", id)) return;
  await deps.store.put("memberships", { id, userId, workspaceId, grantedBy: actor.id, createdAt: now() });
}

export async function revokeWorkspaceAccess(deps: Deps, actor: User, userId: string, workspaceId: string): Promise<void> {
  requireAdmin(actor);
  await deps.store.delete("memberships", `${userId}:${workspaceId}`);
}
