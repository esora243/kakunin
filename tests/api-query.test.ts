import assert from "node:assert/strict";
import test from "node:test";
import { parseNonNegativeNumberParam } from "../lib/api-query";

test("parseNonNegativeNumberParam accepts missing and non-negative values", () => {
  assert.deepEqual(parseNonNegativeNumberParam(null, "salaryMin"), { ok: true, value: undefined });
  assert.deepEqual(parseNonNegativeNumberParam("", "salaryMin"), { ok: true, value: undefined });
  assert.deepEqual(parseNonNegativeNumberParam("0", "salaryMin"), { ok: true, value: 0 });
  assert.deepEqual(parseNonNegativeNumberParam("1500", "salaryMin"), { ok: true, value: 1500 });
});

test("parseNonNegativeNumberParam rejects negative or non-finite values", () => {
  assert.deepEqual(parseNonNegativeNumberParam("-1", "salaryMin"), {
    ok: false,
    message: "salaryMin は0以上の数値で指定してください",
  });
  assert.deepEqual(parseNonNegativeNumberParam("abc", "salaryMin"), {
    ok: false,
    message: "salaryMin は0以上の数値で指定してください",
  });
  assert.deepEqual(parseNonNegativeNumberParam("Infinity", "salaryMin"), {
    ok: false,
    message: "salaryMin は0以上の数値で指定してください",
  });
});
