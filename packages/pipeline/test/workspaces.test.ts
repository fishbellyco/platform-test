import assert from "node:assert/strict";
import { test } from "node:test";
import type { User } from "@fishbelly/core";
import {
  approveDesign,
  canReadAsset,
  createSession,
  createUser,
  getWorkspaceDesign,
  grantWorkspaceAccess,
  listUserAccess,
  listUserWorkspaces,
  listWorkspaceSessions,
  MemoryAssetStorage,
  MemoryStore,
  mockProviders,
  revokeWorkspaceAccess,
  runProduction,
  setUserRole,
  submitPrompt,
  type Deps,
} from "../src/index";

async function setup() {
  const deps: Deps = { store: new MemoryStore(), assets: new MemoryAssetStorage(), providers: mockProviders };
  const admin: User = { id: "usr_admin", email: "admin@example.com", name: "Admin", role: "admin", createdAt: "" };
  await deps.store.put("users", admin);
  const member = await createUser(deps, admin, { email: "Ann@Example.com", name: "Ann", role: "member" });
  const demo = await createSession(deps, { templateId: "vase_001", brandId: "demo" });
  const own = await createSession(deps, { templateId: "vase_001", brandId: "fishbelly" });
  return { deps, admin, member, demo, own };
}

test("a member with no access sees no workspaces and can't open one by URL", async () => {
  const { deps, member, demo } = await setup();
  assert.deepEqual(await listUserWorkspaces(deps, member), []);
  await assert.rejects(listWorkspaceSessions(deps, member, "demo"), /Not found/);
  await assert.rejects(getWorkspaceDesign(deps, member, "demo", demo.id), /Not found/);
});

test("given one workspace, a member sees only that workspace's designs", async () => {
  const { deps, admin, member, demo, own } = await setup();
  await grantWorkspaceAccess(deps, admin, member.id, "demo");

  assert.deepEqual((await listUserWorkspaces(deps, member)).map((w) => w.id), ["demo"]);
  assert.deepEqual((await listWorkspaceSessions(deps, member, "demo")).map((s) => s.id), [demo.id]);
  await assert.rejects(listWorkspaceSessions(deps, member, "fishbelly"), /Not found/);
  assert.equal((await getWorkspaceDesign(deps, member, "demo", demo.id)).session.id, demo.id);
  // A design from another workspace can't be reached through a workspace the member does have.
  await assert.rejects(getWorkspaceDesign(deps, member, "demo", own.id), /Not found/);

  await revokeWorkspaceAccess(deps, admin, member.id, "demo");
  assert.deepEqual(await listUserWorkspaces(deps, member), []);
});

test("admins see every workspace", async () => {
  const { deps, admin, own } = await setup();
  assert.deepEqual((await listUserWorkspaces(deps, admin)).map((w) => w.id), ["fishbelly", "demo"]);
  assert.deepEqual((await listWorkspaceSessions(deps, admin, "fishbelly")).map((s) => s.id), [own.id]);
});

test("only admins manage access, and the last admin can't be demoted", async () => {
  const { deps, admin, member } = await setup();
  await assert.rejects(grantWorkspaceAccess(deps, member, member.id, "demo"), /Only admins/);
  await assert.rejects(createUser(deps, member, { email: "x@example.com", name: "X", role: "admin" }), /Only admins/);
  await assert.rejects(setUserRole(deps, member, member.id, "admin"), /Only admins/);
  await assert.rejects(listUserAccess(deps, member), /Only admins/);
  await assert.rejects(createUser(deps, admin, { email: "ann@example.com", name: "Dup", role: "member" }), /already exists/);
  await assert.rejects(grantWorkspaceAccess(deps, admin, member.id, "nope"), /Workspace not found/);

  await assert.rejects(setUserRole(deps, admin, admin.id, "member"), /at least one admin/);
  await setUserRole(deps, admin, member.id, "admin");
  await setUserRole(deps, admin, admin.id, "member");
});

test("previews are public; meshes only for users with access to the design's workspace", async () => {
  const { deps, admin, member, demo } = await setup();
  const v1 = await submitPrompt(deps, demo.id, "wavy");
  const approved = await approveDesign(deps, demo.id, v1.id);
  await runProduction(deps, approved.id);
  const preview = `previews/${demo.id}/1.svg`;
  const mesh = `models/${approved.id}.stl`;

  assert.equal(await canReadAsset(deps, null, preview), true);
  assert.equal(await canReadAsset(deps, null, mesh), false);
  assert.equal(await canReadAsset(deps, member, mesh), false);
  await grantWorkspaceAccess(deps, admin, member.id, "demo");
  assert.equal(await canReadAsset(deps, member, mesh), true);
  assert.equal(await canReadAsset(deps, admin, "store.json"), false);
});
