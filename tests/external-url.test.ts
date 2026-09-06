import assert from "node:assert/strict";
import test from "node:test";
import { normalizeEmailAddress, normalizeExternalHttpsUrl, normalizeSiteUrl } from "../lib/security/url";

test("external URL normalizer only accepts HTTPS URLs", () => {
  assert.equal(normalizeExternalHttpsUrl("https://example.com/apply?x=1"), "https://example.com/apply?x=1");
  assert.equal(normalizeExternalHttpsUrl("http://example.com/apply"), null);
  assert.equal(normalizeExternalHttpsUrl("javascript:alert(1)"), null);
  assert.equal(normalizeExternalHttpsUrl("data:text/html,hello"), null);
  assert.equal(normalizeExternalHttpsUrl("not a url"), null);
});

test("site URL normalizer allows local HTTP but not arbitrary HTTP", () => {
  assert.equal(normalizeSiteUrl("http://localhost:3000"), "http://localhost:3000/");
  assert.equal(normalizeSiteUrl("http://127.0.0.1:3000"), "http://127.0.0.1:3000/");
  assert.equal(normalizeSiteUrl("http://[::1]:3000"), "http://[::1]:3000/");
  assert.equal(normalizeSiteUrl("https://hugmeid.example"), "https://hugmeid.example/");
  assert.equal(normalizeSiteUrl("http://hugmeid.example"), null);
});

test("email normalizer falls back for unsafe contact destinations", () => {
  assert.equal(normalizeEmailAddress("contact@hugmeid.example"), "contact@hugmeid.example");
  assert.equal(normalizeEmailAddress("mailto:evil@example.com"), "contact@example.com");
  assert.equal(normalizeEmailAddress("not-email"), "contact@example.com");
});
