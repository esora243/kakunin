import assert from "node:assert/strict";
import test from "node:test";
import type { AdminContentRow } from "../lib/content-dto";
import {
  assertContentApprovalTransitionAllowed,
  assertContentSlugChangeAllowed,
  CONTENT_DRAFT_APPROVAL_STATUSES,
  CONTENT_STATE_OPTIONS,
  reactivateContent,
} from "../lib/content-workflow";
import { ForbiddenError, NotFoundError, ValidationError } from "../lib/errors";

function contentRow(overrides: Partial<AdminContentRow> = {}): AdminContentRow {
  return {
    id: "content-1",
    slug: "original-slug",
    content_type: "article",
    category: "jobs",
    title: "Title",
    dek: null,
    body_md: "Body",
    hero_image_url: null,
    related_activity_id: null,
    related_job_id: null,
    published_at: null,
    first_published_at: null,
    approval_status: "draft",
    approval_requested_by_admin_id: null,
    approval_requested_at: null,
    approved_by_admin_id: null,
    approved_at: null,
    is_active: true,
    created_by_admin_id: "admin-1",
    updated_by_admin_id: "admin-1",
    created_at: "2026-07-08T00:00:00.000Z",
    updated_at: "2026-07-08T00:00:00.000Z",
    ...overrides,
  };
}

test("approval transition helper forbids non-owner approve and request-changes while allowing editor review requests", () => {
  assert.doesNotThrow(() => assertContentApprovalTransitionAllowed({ role: "editor" }, "in_review"));
  for (const status of ["approved", "changes_requested"] as const) {
    assert.throws(
      () => assertContentApprovalTransitionAllowed({ role: "editor" }, status),
      (error) =>
        error instanceof ForbiddenError &&
        error.status === 403 &&
        error.code === "owner_approval_required",
    );
  }
  assert.doesNotThrow(() => assertContentApprovalTransitionAllowed({ role: "owner" }, "approved"));
  assert.doesNotThrow(() => assertContentApprovalTransitionAllowed({ role: "owner" }, "changes_requested"));
  assert.throws(() => assertContentApprovalTransitionAllowed({ role: "owner" }, "invalid"), ValidationError);
});

test("reactivateContent invokes the production route dependencies with setActive true and returns cache warning shape", async () => {
  const after = contentRow({ is_active: true });
  const calls: unknown[][] = [];

  const result = await reactivateContent({ adminId: "owner-1" }, "content-1", {
    getContentRowById: async (id) => {
      calls.push(["get", id]);
      return contentRow({ id, is_active: false });
    },
    setActiveWithInvalidation: async (id, actorAdminId) => {
      calls.push(["setActiveWithInvalidation", id, actorAdminId]);
      return { after, cacheResult: { ok: false } };
    },
  });

  assert.deepEqual(result, { content: after, cacheWarning: true });
  assert.deepEqual(calls, [
    ["get", "content-1"],
    ["setActiveWithInvalidation", "content-1", "owner-1"],
  ]);
});

test("reactivateContent throws not found before mutating missing content", async () => {
  let mutated = false;
  await assert.rejects(
    () =>
      reactivateContent({ adminId: "owner-1" }, "missing-content", {
        getContentRowById: async () => null,
        setActiveWithInvalidation: async () => {
          mutated = true;
          return { after: contentRow(), cacheResult: { ok: true } };
        },
      }),
    NotFoundError,
  );
  assert.equal(mutated, false);
});

test("reactivateContent completes external preflight before starting the mutation", async () => {
  const current = contentRow({ is_active: false, published_at: "2026-07-01T00:00:00.000Z" });
  const calls: string[] = [];
  let releaseProbe: (() => void) | undefined;
  const probe = new Promise<void>((resolve) => { releaseProbe = resolve; });
  const resultPromise = reactivateContent({ adminId: "owner-1" }, current.id, {
    getContentRowById: async () => current,
    assertBeforeReactivate: async () => {
      calls.push("probe-start");
      await probe;
      calls.push("probe-complete");
    },
    setActiveWithInvalidation: async (_id, _actorAdminId, snapshot) => {
      calls.push(`mutation:${snapshot.updated_at}`);
      return { after: { ...snapshot, is_active: true }, cacheResult: { ok: true } };
    },
  });

  await Promise.resolve();
  assert.deepEqual(calls, ["probe-start"]);
  releaseProbe?.();
  await resultPromise;
  assert.deepEqual(calls, ["probe-start", "probe-complete", `mutation:${current.updated_at}`]);
});

test("contents state options expose only reachable publish states", () => {
  assert.deepEqual(CONTENT_STATE_OPTIONS, ["draft", "review", "approved", "scheduled", "published", "deactivated"]);
  assert.equal(CONTENT_STATE_OPTIONS.includes("unpublished" as never), false);
});

test("dashboard draft approval statuses match publishStateOf draft semantics for changes requested", () => {
  assert.deepEqual(CONTENT_DRAFT_APPROVAL_STATUSES, ["draft", "changes_requested"]);
});

test("slug changes for previously published content remain owner-confirmed while deactivated", () => {
  const previouslyPublished = contentRow({
    is_active: false,
    first_published_at: "2026-07-01T00:00:00.000Z",
  });
  assert.throws(
    () => assertContentSlugChangeAllowed({ role: "editor" }, previouslyPublished, true),
    ForbiddenError,
  );
  assert.throws(
    () => assertContentSlugChangeAllowed({ role: "owner" }, previouslyPublished, false),
    ValidationError,
  );
  assert.doesNotThrow(() => assertContentSlugChangeAllowed({ role: "owner" }, previouslyPublished, true));
  assert.doesNotThrow(() => assertContentSlugChangeAllowed({ role: "editor" }, contentRow({ published_at: null }), false));
});

test("slug changes for scheduled content are owner-confirmed before first publish", () => {
  const scheduled = contentRow({
    published_at: "2026-07-20T00:00:00.000Z",
    first_published_at: null,
  });
  assert.throws(
    () => assertContentSlugChangeAllowed({ role: "editor" }, scheduled, true),
    ForbiddenError,
  );
  assert.throws(
    () => assertContentSlugChangeAllowed({ role: "owner" }, scheduled, false),
    ValidationError,
  );
  assert.doesNotThrow(() => assertContentSlugChangeAllowed({ role: "owner" }, scheduled, true));
});
