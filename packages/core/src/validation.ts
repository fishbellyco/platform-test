import { label, type ProductTemplate } from "./template";

/** Numbers taken from the finished mesh. `null` means "could not be measured". */
export interface Measurements {
  heightMm: number | null;
  maxDiameterMm: number | null;
  baseDiameterMm: number | null;
  minWallThicknessMm: number | null;
  watertight: boolean | null;
}

export type CheckStatus = "pass" | "fail" | "not_checked";
export interface CheckResult {
  check: string;
  status: CheckStatus;
  detail: string;
}
export type ValidationOutcome = "production_ready" | "needs_review" | "failed";
export interface ValidationReport {
  outcome: ValidationOutcome;
  checks: CheckResult[];
}

// Which measurement answers which template dimension.
// A dimension with no entry here is reported as not_checked, never as a pass.
const MEASURED: Record<string, (m: Measurements) => number | null> = {
  height: (m) => m.heightMm,
  max_diameter: (m) => m.maxDiameterMm,
  base_diameter: (m) => m.baseDiameterMm,
  wall_thickness: (m) => m.minWallThicknessMm,
};

/**
 * The only place pass/fail is decided. Measuring services return numbers; this applies the rules.
 * Any failure -> failed. Anything unmeasured -> needs_review. Otherwise production_ready.
 */
export function evaluateMeasurements(m: Measurements, template: ProductTemplate): ValidationReport {
  const tol = template.validation.toleranceMm;
  const u = template.units;
  const checks: CheckResult[] = [];

  for (const [key, rule] of Object.entries(template.dimensions)) {
    const value = MEASURED[key]?.(m) ?? null;
    if (value === null) {
      checks.push({ check: key, status: "not_checked", detail: `${label(key)} was not measured.` });
      continue;
    }
    const shown = `${value.toFixed(2)} ${u}`;
    let ok: boolean;
    let want: string;
    switch (rule.kind) {
      case "locked":
        ok = Math.abs(value - rule.value) <= tol;
        want = `${rule.value} ±${tol} ${u}`;
        break;
      case "range":
        ok = value >= rule.min - tol && value <= rule.max + tol;
        want = `${rule.min}–${rule.max} ${u}`;
        break;
      case "maximum":
        ok = value <= rule.value + tol;
        want = `at most ${rule.value} ${u}`;
        break;
      case "minimum":
        ok = value >= rule.value;
        want = `at least ${rule.value} ${u}`;
        break;
    }
    checks.push({ check: key, status: ok ? "pass" : "fail", detail: `${shown} (required: ${want})` });
  }

  if (template.validation.requireWatertight) {
    checks.push(
      m.watertight === null
        ? { check: "watertight", status: "not_checked", detail: "Mesh integrity was not measured." }
        : {
            check: "watertight",
            status: m.watertight ? "pass" : "fail",
            detail: m.watertight ? "Closed, printable surface." : "Mesh has holes or open edges.",
          },
    );
  }

  const outcome: ValidationOutcome = checks.some((c) => c.status === "fail")
    ? "failed"
    : checks.some((c) => c.status === "not_checked")
      ? "needs_review"
      : "production_ready";
  return { outcome, checks };
}
