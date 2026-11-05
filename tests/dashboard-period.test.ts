import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatPercent,
  maskSmallCount,
  resolvePeriod,
} from "../src/lib/analytics/dashboard-period";

test("rolling periods are recognized", () => {
  assert.deepEqual(resolvePeriod("3m", []), {
    kind: "months",
    months: 3,
    key: "3m",
    label: "3 derniers mois",
  });
});

test("a month is accepted only if it is still available", () => {
  assert.deepEqual(resolvePeriod("2026-09", ["2026-10", "2026-09"]), {
    kind: "month",
    month: "2026-09",
    key: "2026-09",
    label: "septembre 2026",
  });

  for (const value of ["2025-01", "2026-13", "2026-9", "'; DROP", undefined]) {
    assert.equal(resolvePeriod(value, ["2026-10", "2026-09"]).key, "30d");
  }
});

test("small crossed counts are masked", () => {
  assert.equal(maskSmallCount(0), "—");
  assert.equal(maskSmallCount(1), "< 10");
  assert.equal(maskSmallCount(9), "< 10");
  assert.equal(maskSmallCount(10), "10");
  assert.equal(maskSmallCount(1234).replace(/\s/g, " "), "1 234");
});

test("percentages handle an empty total", () => {
  assert.equal(formatPercent(1, 0), "—");
  assert.equal(formatPercent(1, 3), "33 %");
});
