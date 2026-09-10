import assert from "node:assert/strict";
import test from "node:test";
import { formatJapanDateTime } from "../lib/date-time";

test("formatJapanDateTime displays UTC timestamps in Japan time", () => {
  assert.equal(formatJapanDateTime("2026-07-11T13:59:15.000Z"), "2026-07-11 22:59");
});

test("formatJapanDateTime handles the date boundary in Japan time", () => {
  assert.equal(formatJapanDateTime("2026-07-11T16:30:00.000Z"), "2026-07-12 01:30");
});

test("formatJapanDateTime preserves invalid input", () => {
  assert.equal(formatJapanDateTime("unknown"), "unknown");
});
