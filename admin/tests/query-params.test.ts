import assert from "node:assert/strict";
import test from "node:test";
import { ValidationError } from "../lib/errors";
import {
  boundedNonNegativeIntegerParam,
  integerParam,
  isoDateParam,
  optionalIntegerParam,
  pageUuidParam,
  singleStringParam,
  stringParamFromAllowlist,
  uuidParam,
} from "../lib/query-params";

test("stringParamFromAllowlist ignores malformed or unknown values", () => {
  assert.equal(stringParamFromAllowlist("not-a-uuid", ["id-1", "id-2"]), undefined);
  assert.equal(stringParamFromAllowlist("id-1", ["id-1", "id-2"]), "id-1");
});

test("integerParam rejects malformed integers", () => {
  assert.throws(
    () => integerParam("abc", "Academic year"),
    (error) => error instanceof ValidationError && error.message.includes("valid integer"),
  );
});

test("optionalIntegerParam ignores malformed integers for server-rendered filters", () => {
  assert.equal(optionalIntegerParam("abc"), undefined);
  assert.equal(optionalIntegerParam("2026"), 2026);
});

test("singleStringParam normalizes duplicate query params deterministically", () => {
  assert.equal(singleStringParam(["a", "b"]), "a");
  assert.equal(singleStringParam("  hello  "), "hello");
});

test("uuidParam rejects malformed route ids", () => {
  assert.throws(
    () => uuidParam("not-a-uuid", "Job id"),
    (error) => error instanceof ValidationError && error.message.includes("UUID"),
  );
});

test("pageUuidParam returns undefined for malformed route ids", () => {
  assert.equal(pageUuidParam("not-a-uuid"), undefined);
  assert.equal(pageUuidParam("11111111-1111-1111-1111-111111111111"), "11111111-1111-1111-1111-111111111111");
});

test("boundedNonNegativeIntegerParam rejects huge integers", () => {
  assert.throws(
    () => boundedNonNegativeIntegerParam("999999999999", "Offset", { max: 5000 }),
    (error) => error instanceof ValidationError && error.message.includes("between 0 and 5000"),
  );
});

test("isoDateParam rejects malformed audit dates", () => {
  assert.throws(
    () => isoDateParam("2026-07-32", "From"),
    (error) => error instanceof ValidationError && error.message.includes("YYYY-MM-DD"),
  );
  assert.throws(
    () => isoDateParam("2026-02-31", "From"),
    (error) => error instanceof ValidationError && error.message.includes("YYYY-MM-DD"),
  );
});
