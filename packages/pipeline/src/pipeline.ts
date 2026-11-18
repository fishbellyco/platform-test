import { randomUUID } from "node:crypto";
import {
  composePrompts,
  defaultSpec,
  enforceConstraints,
  evaluateMeasurements,
  getBrand,
  getTemplate,
  needsWordmark,
  type ApprovedDesign,
  type Brand,
  type DesignSession,
  type DesignVersion,
  type GenerationJob,
  type JobKind,
  type ManufacturingAsset,
  type ProductTemplate,
  type SessionStatus,
} from "@fishbelly/core";
import type { AssetStorage } from "./assets";
import type { Providers } from "./providers/types";
import type { Store } from "./store";

export interface Deps {
  store: Store;
  assets: AssetStorage;
  providers: Providers;
}

/** An error whose message is safe to show to the customer. */
export class PipelineError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const now = () => new Date().toISOString();
const newId = (prefix: string) => `${prefix}_${randomUUID()}`;
const MAX_PROMPT = 1000;
const MAX_VERSIONS = 30; // cost guard: revisions per session

/**
 * Runs one pipeline step and records it as a generation job, whether it succeeds or fails.
 * Every provider call goes through here. `summary` is what gets stored as the job output,
 * so large payloads (meshes, images) stay out of the jobs table.
 */
async function runStep<T>(
  deps: Deps,
  sessionId: string,
  kind: JobKind,
  provider: string,
  input: unknown,
  fn: () => Promise<{ result: T; summary: unknown; costUsd?: number }>,
): Promise<T> {
  const started = Date.now();
  const job: GenerationJob = {
    id: newId("job"),
    sessionId,
    kind,
    provider,
    status: "running",
    input,
    output: null,
    error: null,
    costUsd: 0,
    startedAt: now(),
    finishedAt: null,
    durationMs: null,
  };
  await deps.store.put("jobs", job);
  try {
    const { result, summary, costUsd } = await fn();
    Object.assign(job, { status: "succeeded", output: summary, costUsd: costUsd ?? 0 });
    return result;
  } catch (err) {
    Object.assign(job, { status: "failed", error: err instanceof Error ? err.message : String(err) });
    throw err;
  } finally {
    job.finishedAt = now();
    job.durationMs = Date.now() - started;
    await deps.store.put("jobs", job);
  }
}

async function loadSession(
  deps: Deps,
  sessionId: string,
): Promise<{ session: DesignSession; template: ProductTemplate; brand: Brand }> {
  const session = await deps.store.get("sessions", sessionId);
  if (!session) throw new PipelineError("Design session not found.", 404);
  const template = getTemplate(session.templateId);
  const brand = getBrand(session.brandId);
  if (!template || !brand) throw new PipelineError("This product is no longer available.", 404);
  return { session, template, brand };
}

async function setStatus(deps: Deps, session: DesignSession, status: SessionStatus): Promise<void> {
  session.status = status;
  session.updatedAt = now();
  await deps.store.put("sessions", session);
}

export async function createSession(
  deps: Deps,
  input: { templateId: string; brandId: string },
): Promise<DesignSession> {
  const template = getTemplate(input.templateId);
  if (!template) throw new PipelineError("Unknown product.", 404);
  const brand = getBrand(input.brandId);
  if (!brand || !brand.templateIds.includes(template.id) || (needsWordmark(template) && !brand.wordmark)) {
    throw new PipelineError("This product is not available for this brand.", 403);
  }
  const session: DesignSession = {
    id: newId("ses"),
    workspaceId: brand.workspaceId,
    brandId: brand.id,
    templateId: template.id,
    templateVersion: template.version,
    status: "designing",
    currentVersionId: null,
    createdAt: now(),
    updatedAt: now(),
  };
  await deps.store.put("sessions", session);
  return session;
}

/** Prompt -> interpret -> enforce constraints -> preview. Returns the new design version. */
export async function submitPrompt(deps: Deps, sessionId: string, rawPrompt: string): Promise<DesignVersion> {
  const { session, template, brand } = await loadSession(deps, sessionId);
  if (session.status !== "designing") {
    throw new PipelineError("This design has been approved and can no longer be changed.", 409);
  }
  const prompt = rawPrompt.trim();
  if (!prompt) throw new PipelineError("Describe what you'd like first.");
  if (prompt.length > MAX_PROMPT) throw new PipelineError(`Keep it under ${MAX_PROMPT} characters.`);

  const versions = await deps.store.list("versions", { sessionId });
  if (versions.length >= MAX_VERSIONS) {
    throw new PipelineError("You've reached the revision limit for this design.", 429);
  }
  const previous = versions.find((v) => v.id === session.currentVersionId) ?? null;
  const current = previous?.spec ?? defaultSpec(template);
  const { interpreter, preview } = deps.providers;

  const interpreted = await runStep(deps, sessionId, "interpret", interpreter.name, { prompt, current }, async () => {
    const out = await interpreter.interpret({ prompt, current, template });
    return { result: out, summary: { proposed: out.proposed, notes: out.notes }, costUsd: out.costUsd };
  });

  // The model proposes; code decides.
  const { spec, adjustments } = enforceConstraints(interpreted.proposed, template);

  const index = versions.length + 1;
  // Built from the enforced spec, not the customer's words.
  const stepInput = {
    prompt: composePrompts(brand, template, spec).preview,
    referenceImages: template.referenceImages,
    previousPreviewUrl: previous?.previewUrl ?? null,
    spec,
  };
  const previewUrl = await runStep(deps, sessionId, "preview", preview.name, stepInput, async () => {
    const out = await preview.generate({ ...stepInput, template, brand });
    const url = await deps.assets.put(`previews/${sessionId}/${index}.${out.extension}`, out.content);
    return { result: url, summary: { previewUrl: url }, costUsd: out.costUsd };
  });

  const version: DesignVersion = {
    id: newId("ver"),
    sessionId,
    index,
    prompt,
    spec,
    notes: [...interpreted.notes, ...adjustments],
    previewUrl,
    createdAt: now(),
  };
  await deps.store.put("versions", version);
  session.currentVersionId = version.id;
  await setStatus(deps, session, "designing");
  return version;
}

/** Locks one version as the immutable approved design. */
export async function approveDesign(deps: Deps, sessionId: string, versionId: string): Promise<ApprovedDesign> {
  const { session } = await loadSession(deps, sessionId);
  if (session.status !== "designing") throw new PipelineError("This design has already been approved.", 409);
  const versions = await deps.store.list("versions", { sessionId });
  const version = versions.find((v) => v.id === versionId);
  if (!version) throw new PipelineError("That version doesn't belong to this design.", 404);

  const approved: ApprovedDesign = {
    id: newId("des"),
    sessionId,
    versionId: version.id,
    templateId: session.templateId,
    templateVersion: session.templateVersion,
    spec: version.spec,
    previewUrl: version.previewUrl,
    prompts: versions.filter((v) => v.index <= version.index).map((v) => v.prompt),
    approvedAt: now(),
  };
  await deps.store.put("approved", approved);
  await setStatus(deps, session, "approved");
  return approved;
}

/**
 * Approved design -> manufacturing reference (if the template has one) -> 3D model ->
 * measurements -> validation -> manufacturing asset.
 * Runs in-process for now. With real providers this becomes an Inngest function,
 * one step.run() per runStep() below.
 * TODO: scale + base merge before measuring, and a repair/regenerate loop on failure.
 */
export async function runProduction(deps: Deps, approvedId: string): Promise<ManufacturingAsset> {
  const approved = await deps.store.get("approved", approvedId);
  if (!approved) throw new PipelineError("Approved design not found.", 404);
  const { session, template, brand } = await loadSession(deps, approved.sessionId);
  if (session.status !== "approved" && session.status !== "failed") {
    throw new PipelineError("Production has already started for this design.", 409);
  }
  const { reference, model, geometry } = deps.providers;
  const sessionId = session.id;
  const spec = approved.spec;
  const prompts = composePrompts(brand, template, spec);
  await setStatus(deps, session, "in_production");

  try {
    // Only for templates that define it: a clean front-on image for 3D, made from the approved render.
    let referenceImageUrl: string | null = null;
    if (prompts.manufacturingReference) {
      const input = { prompt: prompts.manufacturingReference, approvedPreviewUrl: approved.previewUrl, spec };
      referenceImageUrl = await runStep(deps, sessionId, "manufacturing_reference", reference.name, input, async () => {
        const out = await reference.generate({ ...input, template, brand });
        const url = await deps.assets.put(`manufacturing/${approved.id}.${out.extension}`, out.content);
        return { result: url, summary: { referenceImageUrl: url }, costUsd: out.costUsd };
      });
    }

    const meshKey = `models/${approved.id}.stl`;
    const modelInput = { prompt: prompts.model3d, imageUrl: referenceImageUrl ?? approved.previewUrl, spec };
    const generated = await runStep(deps, sessionId, "model_3d", model.name, { approvedId, ...modelInput }, async () => {
      const out = await model.generate({ ...modelInput, template });
      const meshUrl = await deps.assets.put(meshKey, out.content);
      return { result: { ...out, meshUrl }, summary: { meshUrl, bytes: out.content.length }, costUsd: out.costUsd };
    });

    const report = await runStep(deps, sessionId, "geometry", geometry.name, { meshUrl: generated.meshUrl }, async () => {
      const measurements = await geometry.measure({ mesh: generated.content, format: generated.format });
      const evaluated = evaluateMeasurements(measurements, template);
      return { result: { measurements, ...evaluated }, summary: { measurements, ...evaluated } };
    });

    const asset: ManufacturingAsset = {
      id: newId("mfa"),
      sessionId,
      approvedDesignId: approved.id,
      referenceImageUrl,
      meshUrl: generated.meshUrl,
      format: generated.format,
      measurements: report.measurements,
      checks: report.checks,
      outcome: report.outcome,
      createdAt: now(),
    };
    await deps.store.put("assets", asset);
    await setStatus(deps, session, report.outcome);
    return asset;
  } catch (err) {
    await setStatus(deps, session, "failed");
    throw err;
  }
}
