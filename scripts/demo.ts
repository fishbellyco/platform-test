// The whole journey in the terminal, on mocks. Run with: pnpm demo
import {
  approveDesign,
  createSession,
  MemoryAssetStorage,
  MemoryStore,
  mockProviders,
  runProduction,
  submitPrompt,
  type Deps,
} from "../packages/pipeline/src/index";

const deps: Deps = { store: new MemoryStore(), assets: new MemoryAssetStorage(), providers: mockProviders };
const prompts = [
  "A vase with a flowing texture inspired by ocean waves, slightly asymmetric, in blue",
  "Make the texture more subtle and the vase taller",
  "Make the base much narrower",
];

const session = await createSession(deps, { templateId: "vase_001", brandId: null });
console.log(`session ${session.id}\n`);

let last = null;
for (const prompt of prompts) {
  last = await submitPrompt(deps, session.id, prompt);
  console.log(`v${last.index}  "${prompt}"`);
  console.log(`    spec: ${JSON.stringify({ ...last.spec.dimensions, ...last.spec.attributes, colour: last.spec.colour })}`);
  for (const note of last.notes) console.log(`    note: ${note}`);
}

const approved = await approveDesign(deps, session.id, last!.id);
console.log(`\napproved ${approved.id} (version ${last!.index})`);

const asset = await runProduction(deps, approved.id);
console.log(`\nvalidation: ${asset.outcome}`);
for (const check of asset.checks) console.log(`    ${check.status.padEnd(11)} ${check.check}: ${check.detail}`);

console.log("\njobs:");
for (const job of await deps.store.list("jobs", { sessionId: session.id })) {
  console.log(`    ${job.kind.padEnd(9)} ${job.provider.padEnd(17)} ${job.status}  ${job.durationMs}ms  $${job.costUsd}`);
}
