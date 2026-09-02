import assert from "node:assert/strict";
import test from "node:test";
import { relatedTypePredicate } from "../lib/inquiry-filters";

test("relatedTypePredicate matches METADATA_SELECT precedence for job", () => {
  assert.equal(relatedTypePredicate("job"), "i.job_id is not null");
});

test("relatedTypePredicate matches METADATA_SELECT precedence for activity and content", () => {
  assert.equal(relatedTypePredicate("activity"), "i.job_id is null and i.activity_id is not null");
  assert.equal(relatedTypePredicate("content"), "i.job_id is null and i.activity_id is null and i.content_id is not null");
});
