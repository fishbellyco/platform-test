import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultSpec, getTemplate } from "@fishbelly/core";
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

const makeDeps = (): Deps => ({ store: new MemoryStore(), assets: new MemoryAssetStorage(), providers: mockProviders });

test("fisherman journey: personalise -> approve -> manufacturing reference -> 3D -> checks", async () => {
  const deps = makeDeps();
  const session = await createSession(deps, { templateId: "fisherman_001", brandId: "fishbelly" });
  assert.equal(session.workspaceId, "fishbelly");

  const v1 = await submitPrompt(deps, session.id, "A yellow sou'wester, a grey beard and round glasses");
  assert.equal(v1.spec.attributes.headwear?.description, "sou'wester rain hat");
  assert.equal(v1.spec.attributes.eyewear?.description, "round glasses");
  const v2 = await submitPrompt(deps, session.id, "Swap the fish for a shark and make him twice as big");
  assert.equal(v2.spec.attributes.fish, undefined);
  assert.equal(v2.notes.length, 2);

  const previewJob = (await deps.store.list("jobs", { sessionId: session.id, kind: "preview" }))[0]!;
  const previewInput = previewJob.input as { prompt: string; referenceImages: string[] };
  assert.match(previewInput.prompt, /"FISHBELLY"/);
  assert.deepEqual(previewInput.referenceImages, ["fisherman_001/lineup.jpg"]);

  const approved = await approveDesign(deps, session.id, v2.id);
  const asset = await runProduction(deps, approved.id);
  assert.match(asset.referenceImageUrl ?? "", /^memory:\/\/manufacturing\/des_/);

  const jobs = await deps.store.list("jobs", { sessionId: session.id });
  assert.deepEqual(jobs.slice(-3).map((j) => j.kind), ["manufacturing_reference", "model_3d", "geometry"]);
  const modelInput = jobs.at(-2)!.input as { imageUrl: string; prompt: string };
  assert.equal(modelInput.imageUrl, asset.referenceImageUrl, "3D is built from the manufacturing reference");

  const status = Object.fromEntries(asset.checks.map((c) => [c.check, c.status]));
  assert.deepEqual(status, {
    height: "pass",
    base_diameter: "pass",
    max_diameter: "pass",
    wall_thickness: "not_checked",
    watertight: "pass",
    single_piece: "pass",
  });
  assert.equal(asset.outcome, "needs_review");
});

test("the STL measurer counts loose pieces", () => {
  const template = getTemplate("fisherman_001")!;
  const stl = buildMockStl(defaultSpec(template), template);
  assert.equal(measureAsciiStl(stl).components, 1);
  const shifted = stl.replace(/vertex (\S+) (\S+) (\S+)/g, (_m, x, y, z) => `vertex ${Number(x) + 200} ${y} ${z}`);
  const twoPieces = measureAsciiStl(stl.replace("endsolid fishbelly_mock\n", "") + shifted.replace("solid fishbelly_mock\n", ""));
  assert.equal(twoPieces.components, 2);
  assert.equal(twoPieces.watertight, true, "watertight alone doesn't catch a floating part");
});
