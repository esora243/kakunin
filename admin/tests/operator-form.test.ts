import assert from "node:assert/strict";
import test from "node:test";
import { isSafePublicUrl, japanLocalDateTimeToIso, operatorSlug } from "../lib/operator-form";

test("operatorSlug creates URL-safe values for Latin and Japanese titles", () => {
  assert.equal(operatorSlug("Summer Internship 2026"), "summer-internship-2026");
  assert.match(operatorSlug("学生向け交流会"), /^item-[a-z0-9]+$/);
  assert.equal(operatorSlug("  "), "");
});

test("japanLocalDateTimeToIso converts admin input from Japan time to UTC", () => {
  assert.equal(japanLocalDateTimeToIso("2026-07-12T10:30"), "2026-07-12T01:30:00.000Z");
  assert.equal(japanLocalDateTimeToIso("2026-07-12T00:30"), "2026-07-11T15:30:00.000Z");
  assert.equal(japanLocalDateTimeToIso("2026-02-30T10:00"), null);
  assert.equal(japanLocalDateTimeToIso(""), null);
});

test("isSafePublicUrl accepts web destinations and rejects unsafe or malformed values", () => {
  assert.equal(isSafePublicUrl("https://example.com/apply"), true);
  assert.equal(isSafePublicUrl("http://localhost:3000/form"), false);
  assert.equal(isSafePublicUrl("javascript:alert(1)"), false);
  assert.equal(isSafePublicUrl("example.com"), false);
  assert.equal(isSafePublicUrl(""), false);
});
