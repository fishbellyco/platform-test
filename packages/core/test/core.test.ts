import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultSpec, enforceConstraints, evaluateMeasurements, getTemplate, type Measurements } from "../src/index";

const template = getTemplate("vase_001")!;
const good: Measurements = {
  heightMm: 200,
  maxDiameterMm: 130,
  baseDiameterMm: 90,
  minWallThicknessMm: 3.4,
  watertight: true,
  components: 1,
};

test("locked dimensions survive any proposal", () => {
  const { spec, adjustments } = enforceConstraints(
    { ...defaultSpec(template), dimensions: { base_diameter: 40, height: 180 } },
    template,
  );
  assert.equal(spec.dimensions.base_diameter, undefined);
  assert.equal(spec.dimensions.height, 180);
  assert.match(adjustments.join(" "), /base diameter is fixed/);
});

test("range dimensions are clamped", () => {
  const { spec, adjustments } = enforceConstraints({ dimensions: { height: 900 } }, template);
  assert.equal(spec.dimensions.height, 250);
  assert.equal(adjustments.length, 1);
});

test("non-permitted and unknown attributes are dropped", () => {
  const { spec, adjustments } = enforceConstraints(
    {
      attributes: {
        surface_texture: { description: "waves", intensity: 7 },
        base_geometry: { description: "pointed", intensity: 1 },
        handles: { description: "two", intensity: 1 },
      },
    },
    template,
  );
  assert.deepEqual(Object.keys(spec.attributes), ["surface_texture"]);
  assert.equal(spec.attributes.surface_texture?.intensity, 1);
  assert.equal(adjustments.length, 2);
});

test("garbage input falls back to the template defaults", () => {
  const { spec } = enforceConstraints("not an object", template);
  assert.deepEqual(spec, defaultSpec(template));
});

test("validation: all measured and in spec is production ready", () => {
  assert.equal(evaluateMeasurements(good, template).outcome, "production_ready");
});

test("validation: wrong base diameter fails", () => {
  const report = evaluateMeasurements({ ...good, baseDiameterMm: 82 }, template);
  assert.equal(report.outcome, "failed");
  assert.equal(report.checks.find((c) => c.check === "base_diameter")?.status, "fail");
});

test("validation: an unmeasured check is never a pass", () => {
  const report = evaluateMeasurements({ ...good, minWallThicknessMm: null }, template);
  assert.equal(report.outcome, "needs_review");
});
