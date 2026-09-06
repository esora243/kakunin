import assert from "node:assert/strict";
import test from "node:test";
import { ConflictError } from "../lib/errors";
import { assertApprovalStatusMutable, isPubliclyVisible, parseScheduledAt, publishStateOf } from "../lib/publishing";

test("publishStateOf treats is_active=false as deactivated regardless of published_at", () => {
  assert.equal(publishStateOf({ is_active: false, published_at: new Date(Date.now() - 1000).toISOString() }), "deactivated");
  assert.equal(publishStateOf({ is_active: false, published_at: null }), "deactivated");
});

test("publishStateOf treats null published_at as draft", () => {
  assert.equal(publishStateOf({ is_active: true, published_at: null }), "draft");
});

test("publishStateOf has no separate unpublished state", () => {
  const states = [
    publishStateOf({ is_active: true, published_at: null, approval_status: "draft" }),
    publishStateOf({ is_active: true, published_at: null, approval_status: "changes_requested" }),
  ];
  assert.deepEqual(states, ["draft", "draft"]);
});

test("publishStateOf treats approval and future published_at as workflow states", () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  assert.equal(publishStateOf({ is_active: true, published_at: null, approval_status: "in_review" }), "review");
  assert.equal(publishStateOf({ is_active: true, published_at: null, approval_status: "approved" }), "approved");
  assert.equal(publishStateOf({ is_active: true, published_at: future }), "scheduled");
});

test("publishStateOf treats past published_at with is_active=true as published", () => {
  const past = new Date(Date.now() - 60_000).toISOString();
  assert.equal(publishStateOf({ is_active: true, published_at: past }), "published");
});

test("assertApprovalStatusMutable blocks any scheduled or previously published content", () => {
  const past = new Date(Date.now() - 60_000).toISOString();
  const future = new Date(Date.now() + 60_000).toISOString();
  assert.throws(() => assertApprovalStatusMutable({ is_active: true, published_at: past }), ConflictError);
  assert.throws(() => assertApprovalStatusMutable({ is_active: true, published_at: future }), ConflictError);
  assert.throws(() => assertApprovalStatusMutable({ is_active: false, published_at: past }), ConflictError);
  assert.doesNotThrow(() => assertApprovalStatusMutable({ is_active: true, published_at: null }));
  assert.doesNotThrow(() => assertApprovalStatusMutable({ is_active: false, published_at: null }));
});

test("isPubliclyVisible matches publishStateOf === published exactly", () => {
  const past = new Date(Date.now() - 60_000).toISOString();
  assert.equal(isPubliclyVisible({ is_active: true, published_at: past }), true);
  assert.equal(isPubliclyVisible({ is_active: false, published_at: past }), false);
  assert.equal(isPubliclyVisible({ is_active: true, published_at: null }), false);
});

test("parseScheduledAt accepts ISO schedules and defaults empty input to now", () => {
  assert.equal(parseScheduledAt("2026-07-12T01:30:00.000Z").toISOString(), "2026-07-12T01:30:00.000Z");
  const before = Date.now();
  const immediate = parseScheduledAt(null).getTime();
  assert.ok(immediate >= before && immediate <= Date.now());
  assert.throws(() => parseScheduledAt("invalid"));
});
