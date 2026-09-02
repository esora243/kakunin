import assert from "node:assert/strict";
import test from "node:test";
import { assertValidSlug } from "../lib/slug";
import { ValidationError } from "../lib/errors";

test("assertValidSlug accepts lowercase, numbers, and hyphens", () => {
  assert.doesNotThrow(() => assertValidSlug("hello-world-2026"));
  assert.doesNotThrow(() => assertValidSlug("a"));
});

test("assertValidSlug rejects uppercase, spaces, underscores, and leading/trailing hyphens", () => {
  for (const bad of ["Hello-World", "hello world", "hello_world", "-hello", "hello-", "hello--world", ""]) {
    assert.throws(() => assertValidSlug(bad), ValidationError, `expected "${bad}" to be rejected`);
  }
});

test("assertValidSlug rejects overly long slugs", () => {
  assert.throws(() => assertValidSlug("a".repeat(201)), ValidationError);
});
