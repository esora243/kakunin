import assert from "node:assert/strict";
import test from "node:test";
import { assertActivityDateRange } from "../lib/date-range";
import { ValidationError } from "../lib/errors";

test("activity date ordering path accepts ordered startsAt and endsAt values", () => {
  assert.doesNotThrow(() => assertActivityDateRange("2026-07-01T10:00:00Z", "2026-07-01T11:00:00Z"));
});

test("activity date ordering path rejects reversed startsAt and endsAt values with ValidationError", () => {
  assert.throws(
    () => assertActivityDateRange("2026-07-01T12:00:00Z", "2026-07-01T11:00:00Z"),
    (error) => error instanceof ValidationError && error.code === "invalid_request",
  );
});
