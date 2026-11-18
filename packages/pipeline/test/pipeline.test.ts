import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultSpec, evaluateMeasurements, getTemplate } from "@fishbelly/core";
import {
  approveDesign,
  buildMockStl,
  createSession,
  measureAsciiStl,
  MemoryAssetStorage,
  MemoryStore,
  mockProviders,
  runProduction,
  submitPrompt,
  type Deps,
} from "../src/index";

const template = getTemplate("vase_001")!;
const makeDeps = (): Deps => ({
  store: new MemoryStore(),
  assets: new MemoryAssetStorage(),
  providers: mockProviders,
});

test("full journey: prompt -> revise -> approve -> production", async () => {
  const deps = makeDeps();
  const session = await createSession(deps, { templateId: "vase_001", brandId: "demo" });

  const v1 = await submitPrompt(deps, session.id, "Ocean wave texture, a bit taller, in blue");
  assert.equal(v1.spec.dimensions.height, 230);
  assert.equal(v1.spec.colour, "#3b6ea5");
  assert.match(v1.spec.attributes.surface_texture?.description ?? "", /wave/);

  const v2 = await submitPrompt(deps, session.id, "Make the base much narrower and add handles");
  assert.equal(v2.spec.dimensions.base_diameter, undefined, "locked dimension must not enter the spec");
  assert.equal(v2.spec.attributes.handles, undefined, "non-permitted attribute must not enter the spec");
  assert.equal(v2.notes.length, 2);
  assert.equal(v2.spec.dimensions.height, 230, "earlier decisions carry over");

  const approved = await approveDesign(deps, session.id, v2.id);
  assert.deepEqual(approved.prompts, [v1.prompt, v2.prompt]);

  const asset = await runProduction(deps, approved.id);
  const status = Object.fromEntries(asset.checks.map((c) => [c.check, c.status]));
  assert.equal(status.base_diameter, "pass");
  assert.equal(status.height, "pass");
  assert.equal(status.max_diameter, "pass");
  assert.equal(status.watertight, "pass");
  assert.equal(status.wall_thickness, "not_checked");
  assert.equal(asset.outcome, "needs_review", "unmeasured wall thickness must block auto-release");

  const jobs = await deps.store.list("jobs", { sessionId: session.id });
  assert.deepEqual(
    jobs.map((j) => j.kind),
    ["interpret", "preview", "interpret", "preview", "model_3d", "geometry"],
  );
  assert.ok(jobs.every((j) => j.status === "succeeded" && j.durationMs !== null));
  assert.equal((await deps.store.get("sessions", session.id))?.status, "needs_review");
});

test("an approved design is locked", async () => {
  const deps = makeDeps();
  const session = await createSession(deps, { templateId: "vase_001", brandId: "demo" });
  const v1 = await submitPrompt(deps, session.id, "deep vertical grooves");
  const approved = await approveDesign(deps, session.id, v1.id);

  await assert.rejects(submitPrompt(deps, session.id, "make it pink"), /approved/);
  await assert.rejects(approveDesign(deps, session.id, v1.id), /already been approved/);
  await assert.rejects(deps.store.put("approved", { ...approved, previewUrl: "x" }), /immutable/);
});

test("a failed provider is recorded and marks the session failed", async () => {
  const deps = makeDeps();
  deps.providers = {
    ...mockProviders,
    model: { name: "broken-3d", generate: async () => Promise.reject(new Error("provider timeout")) },
  };
  const session = await createSession(deps, { templateId: "vase_001", brandId: "demo" });
  const v1 = await submitPrompt(deps, session.id, "organic shape");
  const approved = await approveDesign(deps, session.id, v1.id);

  await assert.rejects(runProduction(deps, approved.id), /provider timeout/);
  const failed = (await deps.store.list("jobs", { sessionId: session.id })).at(-1);
  assert.equal(failed?.status, "failed");
  assert.equal(failed?.error, "provider timeout");
  assert.equal((await deps.store.get("sessions", session.id))?.status, "failed");
});

test("brand can only open its own products, and the session joins the brand's workspace", async () => {
  const deps = makeDeps();
  await assert.rejects(createSession(deps, { templateId: "vase_001", brandId: "nobody" }), /not available/);
  const session = await createSession(deps, { templateId: "vase_001", brandId: "demo" });
  assert.equal(session.brandId, "demo");
  assert.equal(session.workspaceId, "demo");
});

test("validation catches a mesh at the wrong scale and a mesh with a hole", () => {
  const spec = defaultSpec(template);
  const wrongScale = evaluateMeasurements(measureAsciiStl(buildMockStl(spec, template, 0.9)), template);
  assert.equal(wrongScale.outcome, "failed");
  assert.equal(wrongScale.checks.find((c) => c.check === "base_diameter")?.status, "fail");

  const facets = buildMockStl(spec, template).split("endfacet\n");
  const holed = measureAsciiStl(facets.slice(0, 500).concat(facets.slice(501)).join("endfacet\n"));
  assert.equal(holed.watertight, false);
});
