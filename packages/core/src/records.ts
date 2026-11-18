import type { DesignSpec } from "./designSpec";
import type { CheckResult, Measurements, ValidationOutcome } from "./validation";

// Stored records. db/schema.sql mirrors these for Postgres.

export type SessionStatus =
  | "designing"
  | "approved"
  | "in_production"
  | "production_ready"
  | "needs_review"
  | "failed";

export interface DesignSession {
  id: string;
  /** The client this design belongs to. Set once from the brand; never changes. */
  workspaceId: string;
  /** The brand it was opened through (the standalone studio is Fishbelly's own brand). */
  brandId: string;
  templateId: string;
  templateVersion: number;
  status: SessionStatus;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DesignVersion {
  id: string;
  sessionId: string;
  index: number;
  prompt: string;
  spec: DesignSpec;
  /** What the customer is told about this revision (kept constraints, clamped values). */
  notes: string[];
  previewUrl: string;
  createdAt: string;
}

/** Immutable once written. */
export interface ApprovedDesign {
  id: string;
  sessionId: string;
  versionId: string;
  templateId: string;
  templateVersion: number;
  spec: DesignSpec;
  previewUrl: string;
  prompts: string[];
  approvedAt: string;
}

export type JobKind = "interpret" | "preview" | "model_3d" | "geometry";

/** One row per pipeline step run. This is the debugging trail. */
export interface GenerationJob {
  id: string;
  sessionId: string;
  kind: JobKind;
  provider: string;
  status: "running" | "succeeded" | "failed";
  input: unknown;
  output: unknown;
  error: string | null;
  costUsd: number;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
}

export interface ManufacturingAsset {
  id: string;
  sessionId: string;
  approvedDesignId: string;
  meshUrl: string;
  format: "stl";
  measurements: Measurements;
  checks: CheckResult[];
  outcome: ValidationOutcome;
  createdAt: string;
}

export type UserRole = "admin" | "member";

/** Someone who signs in to the internal app. Customers using /studio or /embed are not users. */
export interface User {
  id: string;
  email: string;
  name: string;
  /** admin: every workspace, and manages access. member: only workspaces they've been given. */
  role: UserRole;
  createdAt: string;
}

/** Gives one member access to one workspace. Id is `${userId}:${workspaceId}`. */
export interface WorkspaceMembership {
  id: string;
  userId: string;
  workspaceId: string;
  grantedBy: string;
  createdAt: string;
}
