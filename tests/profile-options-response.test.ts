import assert from "node:assert/strict";
import test from "node:test";
import { parseProfileOptionsResponse } from "../lib/auth/types";

const validOptions = {
  universities: [{ id: "university-1", name: "浜松医科大学", prefecture: "静岡県" }],
  clubs: [{ id: "club-1", name: "運動部" }],
  specialties: [{ id: "specialty-1", name: "内科" }],
  graduationYears: [2028],
  genders: ["回答しない"],
};

test("parseProfileOptionsResponse returns typed options for the success response shape", () => {
  assert.deepEqual(parseProfileOptionsResponse({ ok: true, item: validOptions }), validOptions);
});

test("parseProfileOptionsResponse normalizes legacy cached universities without prefectures", () => {
  const legacyOptions = {
    ...validOptions,
    universities: [{ id: "university-1", name: "浜松医科大学" }],
  };

  assert.deepEqual(parseProfileOptionsResponse({ ok: true, item: legacyOptions }), {
    ...legacyOptions,
    universities: [{ id: "university-1", name: "浜松医科大学", prefecture: null }],
  });
});

test("parseProfileOptionsResponse rejects API errors and malformed option payloads", () => {
  assert.equal(parseProfileOptionsResponse({ ok: false, error: { code: "internal_error", message: "failed" } }), null);
  assert.equal(
    parseProfileOptionsResponse({
      ok: true,
      item: { ...validOptions, graduationYears: ["2028"] },
    }),
    null,
  );
});
