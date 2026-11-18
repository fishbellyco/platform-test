import assert from "node:assert/strict";
import { test } from "node:test";
import { canAccessWorkspace, visibleWorkspaces, type User, type WorkspaceMembership } from "../src/index";

const user = (id: string, role: User["role"]): User => ({ id, email: `${id}@example.com`, name: id, role, createdAt: "" });
const grant = (userId: string, workspaceId: string): WorkspaceMembership => ({
  id: `${userId}:${workspaceId}`,
  userId,
  workspaceId,
  grantedBy: "admin",
  createdAt: "",
});
const workspaces = [{ id: "a" }, { id: "b" }, { id: "c" }];

test("admins see every workspace without being given access", () => {
  assert.deepEqual(visibleWorkspaces(user("boss", "admin"), workspaces, []).map((w) => w.id), ["a", "b", "c"]);
});

test("members see only the workspaces they were given", () => {
  const ann = user("ann", "member");
  const memberships = [grant("ann", "b"), grant("bob", "a"), grant("bob", "c")];
  assert.deepEqual(visibleWorkspaces(ann, workspaces, memberships).map((w) => w.id), ["b"]);
  assert.equal(canAccessWorkspace(ann, "a", memberships), false, "another user's access is not shared");
  assert.equal(canAccessWorkspace(user("new", "member"), "a", memberships), false);
});
