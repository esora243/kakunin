import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type { PoolClient } from "pg";
import type { AdminContentRow } from "../lib/content-dto";
import { restoreContentVersion, setActive, setPublishedAt, updateContent } from "../lib/contents";
import { ConflictError } from "../lib/errors";

type QueryResponse = { rows: unknown[] } | { error: Error };

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

function fakeClient(responses: QueryResponse[]) {
  const calls: Array<{ text: string; values?: unknown[] }> = [];
  const client = {
    query: async (text: string, values?: unknown[]) => {
      calls.push({ text, values });
      const response = responses.shift();
      if (!response) throw new Error("unexpected query");
      if ("error" in response) throw response.error;
      return response;
    },
  } as unknown as PoolClient;
  return { client, calls };
}

test("content workflow mutations lock the content row with FOR UPDATE", async () => {
  const publishAt = new Date("2026-07-20T00:00:00.000Z");
  const before = contentRow({ approval_status: "approved" });
  const after = contentRow({
    approval_status: "approved",
    published_at: publishAt.toISOString(),
    first_published_at: publishAt.toISOString(),
  });
  const { client, calls } = fakeClient([
    { rows: [before] },
    { rows: [] },
    { rows: [] },
    { rows: [after] },
    { rows: [] },
    { rows: [] },
  ]);

  await setPublishedAt(client, "content-1", publishAt, "admin-1");

  assert.match(calls[0]?.text ?? "", /for update/i);
  assert.match(calls[3]?.text ?? "", /first_published_at = case/i);
  assert.equal(calls[3]?.values?.[0], publishAt);
});

test("content updates run route policy callbacks after acquiring the row lock", async () => {
  const before = contentRow({ slug: "locked-slug" });
  const after = contentRow({ slug: "new-slug" });
  const { client, calls } = fakeClient([
    { rows: [before] },
    { rows: [] },
    { rows: [] },
    { rows: [after] },
    { rows: [] },
    { rows: [] },
  ]);
  const callbackOrder: string[] = [];

  await updateContent(
    client,
    "content-1",
    { slug: "new-slug" },
    "admin-1",
    {
      assertBeforeUpdate: (current) => {
        callbackOrder.push(current.slug);
        assert.equal(calls.length, 1);
        assert.match(calls[0]?.text ?? "", /for update/i);
      },
    },
  );

  assert.deepEqual(callbackOrder, ["locked-slug"]);
  assert.match(calls[3]?.text ?? "", /update contents set/);
});

test("content updates stop before mutation when locked row slug policy rejects", async () => {
  const { client, calls } = fakeClient([{ rows: [contentRow({ first_published_at: "2026-07-01T00:00:00.000Z" })] }]);

  await assert.rejects(
    () =>
      updateContent(client, "content-1", { slug: "new-slug" }, "admin-1", {
        assertBeforeUpdate: () => {
          throw new ConflictError("blocked", "blocked");
        },
      }),
    (error) => error instanceof ConflictError && error.code === "blocked",
  );
  assert.equal(calls.length, 1);
  assert.match(calls[0]?.text ?? "", /for update/i);
});

test("stale content updates stop before mutation, audit, or version writes", async () => {
  const { client, calls } = fakeClient([{ rows: [contentRow()] }, { rows: [{ matches: false }] }]);

  await assert.rejects(
    () =>
      updateContent(client, "content-1", { title: "Changed" }, "admin-1", {
        expectedUpdatedAt: "2026-07-09T00:00:00.000Z",
      }),
    (error) => error instanceof ConflictError && error.code === "stale_write",
  );
  assert.equal(calls.length, 2);
  assert.match(calls[0]?.text ?? "", /for update/i);
  assert.match(calls[1]?.text ?? "", /timestamptz/);
});

test("stale publish and reactivation stop before asset locks or mutation writes", async () => {
  for (const mutate of [
    (client: PoolClient) => setPublishedAt(client, "content-1", new Date(), "admin-1", {
      expectedUpdatedAt: "2026-07-09T00:00:00.000Z",
    }),
    (client: PoolClient) => setActive(client, "content-1", true, "admin-1", {
      expectedUpdatedAt: "2026-07-09T00:00:00.000Z",
    }),
  ]) {
    const { client, calls } = fakeClient([
      { rows: [contentRow({ approval_status: "approved" })] },
      { rows: [{ matches: false }] },
    ]);
    await assert.rejects(
      () => mutate(client),
      (error) => error instanceof ConflictError && error.code === "stale_write",
    );
    assert.equal(calls.length, 2);
    assert.doesNotMatch(calls.map((call) => call.text).join("\n"), /pg_advisory|update contents|audit|content_versions/i);
  }
});

test("hero snapshot mismatch stops publish after row lock but before the asset advisory lock", async () => {
  const before = contentRow({ approval_status: "approved", hero_image_url: "https://assets.example/new.webp" });
  const { client, calls } = fakeClient([
    { rows: [before] },
    { rows: [{ matches: true }] },
  ]);

  await assert.rejects(
    () => setPublishedAt(client, "content-1", new Date(), "admin-1", {
      expectedUpdatedAt: before.updated_at,
      assertBeforePublish: (lockedBefore) => {
        if (lockedBefore.hero_image_url !== "https://assets.example/old.webp") {
          throw new ConflictError("changed", "stale_write");
        }
      },
    }),
    (error) => error instanceof ConflictError && error.code === "stale_write",
  );
  assert.equal(calls.length, 2);
  assert.doesNotMatch(calls.map((call) => call.text).join("\n"), /pg_advisory|update contents/i);
});

test("material edits reset approval metadata for an approved unpublished content", async () => {
  const before = contentRow({
    approval_status: "approved",
    approval_requested_by_admin_id: "admin-2",
    approval_requested_at: "2026-07-08T01:00:00.000Z",
    approved_by_admin_id: "admin-1",
    approved_at: "2026-07-08T02:00:00.000Z",
  });
  const after = contentRow({ title: "Changed", approval_status: "draft" });
  const { client, calls } = fakeClient([
    { rows: [before] },
    { rows: [] },
    { rows: [] },
    { rows: [after] },
    { rows: [] },
    { rows: [] },
  ]);

  await updateContent(client, "content-1", { title: "Changed" }, "admin-2");

  assert.match(calls[3]?.text ?? "", /approval_status = 'draft'/i);
  assert.match(calls[3]?.text ?? "", /approval_requested_by_admin_id = null/i);
  assert.match(calls[3]?.text ?? "", /approved_by_admin_id = null/i);
  assert.doesNotMatch(calls[3]?.text ?? "", /published_at = null/i);
});

test("material edits cancel a scheduled publish and require approval again", async () => {
  const scheduledAt = "2099-07-20T00:00:00.000Z";
  const before = contentRow({
    approval_status: "approved",
    published_at: scheduledAt,
    approved_by_admin_id: "admin-1",
    approved_at: "2026-07-08T02:00:00.000Z",
  });
  const after = contentRow({ body_md: "Changed", approval_status: "draft", published_at: null });
  const { client, calls } = fakeClient([
    { rows: [before] },
    { rows: [] },
    { rows: [] },
    { rows: [after] },
    { rows: [] },
    { rows: [] },
  ]);

  await updateContent(client, "content-1", { bodyMd: "Changed" }, "admin-2");

  assert.match(calls[3]?.text ?? "", /published_at = null/i);
  assert.match(calls[3]?.text ?? "", /approval_status = 'draft'/i);
});

test("material edits reset in-review content but preserve changes-requested workflow", async () => {
  for (const [approvalStatus, shouldReset] of [
    ["in_review", true],
    ["changes_requested", false],
  ] as const) {
    const before = contentRow({ approval_status: approvalStatus });
    const after = contentRow({ title: "Changed", approval_status: shouldReset ? "draft" : approvalStatus });
    const { client, calls } = fakeClient([
      { rows: [before] },
      { rows: [] },
      { rows: [] },
      { rows: [after] },
      { rows: [] },
      { rows: [] },
    ]);

    await updateContent(client, "content-1", { title: "Changed" }, "admin-2");

    assert.equal(/approval_status = 'draft'/i.test(calls[3]?.text ?? ""), shouldReset);
  }
});

test("normalized no-op edits keep approval and scheduled publication bound to the same revision", async () => {
  const before = contentRow({
    approval_status: "approved",
    published_at: "2099-07-20T00:00:00.000Z",
    approved_by_admin_id: "admin-1",
    approved_at: "2026-07-08T02:00:00.000Z",
  });
  const { client, calls } = fakeClient([
    { rows: [before] },
    { rows: [] },
    { rows: [] },
    { rows: [before] },
    { rows: [] },
    { rows: [] },
  ]);

  await updateContent(client, "content-1", { title: `  ${before.title}  ` }, "admin-2");

  assert.doesNotMatch(calls[3]?.text ?? "", /approval_status = 'draft'/i);
  assert.doesNotMatch(calls[3]?.text ?? "", /published_at = null/i);
});

test("live edits preserve the approval metadata and published timestamp", async () => {
  const before = contentRow({
    approval_status: "approved",
    published_at: "2020-07-20T00:00:00.000Z",
    approved_by_admin_id: "admin-1",
    approved_at: "2020-07-19T00:00:00.000Z",
  });
  const after = contentRow({ ...before, title: "Live change" });
  const { client, calls } = fakeClient([
    { rows: [before] },
    { rows: [] },
    { rows: [] },
    { rows: [after] },
    { rows: [] },
    { rows: [] },
  ]);

  await updateContent(client, "content-1", { title: "Live change" }, "admin-2");

  assert.doesNotMatch(calls[3]?.text ?? "", /approval_status = 'draft'/i);
  assert.doesNotMatch(calls[3]?.text ?? "", /published_at = null/i);
});

test("content version restore preserves deactivated state", async () => {
  const before = contentRow({ is_active: false, first_published_at: "2026-07-01T00:00:00.000Z" });
  const snapshot = contentRow({ slug: "snapshot-slug", is_active: true, published_at: "2026-07-02T00:00:00.000Z" });
  const after = contentRow({ slug: "snapshot-slug", is_active: false, published_at: null, first_published_at: "2026-07-01T00:00:00.000Z" });
  const { client, calls } = fakeClient([
    { rows: [before] },
    { rows: [{ snapshot }] },
    { rows: [] },
    { rows: [] },
    { rows: [after] },
    { rows: [] },
    { rows: [] },
  ]);

  const result = await restoreContentVersion(client, "content-1", 2, "admin-1");

  assert.equal(result.after.is_active, false);
  assert.equal(calls[4]?.values?.[10], false);
  assert.match(calls[4]?.text ?? "", /is_active = \$11/);
});

test("content version restore maps slug collisions to ConflictError", async () => {
  const duplicate = Object.assign(new Error("duplicate"), { code: "23505" as const, constraint: "contents_slug_key" });
  const { client } = fakeClient([
    { rows: [contentRow()] },
    { rows: [{ snapshot: contentRow({ slug: "taken-slug" }) }] },
    { rows: [] },
    { rows: [] },
    { error: duplicate },
  ]);

  await assert.rejects(
    () => restoreContentVersion(client, "content-1", 2, "admin-1"),
    (error) => error instanceof ConflictError && error.status === 409 && error.code === "slug_conflict",
  );
});

test("content form prompts for scheduled or historically published slug changes", () => {
  const source = readFileSync(join(process.cwd(), "components/contents/ContentForm.tsx"), "utf8");

  assert.match(source, /content\?\.first_published_at \|\| content\?\.published_at/);
  assert.match(source, /slugChangeRequiresConfirmation && slugChanged/);
  assert.doesNotMatch(source, /isPublished && slugChanged/);
});

test("content PATCH reports approval resets and the form explains required follow-up", () => {
  const routeSource = readFileSync(join(process.cwd(), "app/api/contents/[id]/route.ts"), "utf8");
  const formSource = readFileSync(join(process.cwd(), "components/contents/ContentForm.tsx"), "utf8");

  assert.match(routeSource, /approvalReset:/);
  assert.match(routeSource, /scheduleCancelled:/);
  assert.match(formSource, /result\.scheduleCancelled/);
  assert.match(formSource, /もう一度承認・予約してください/);
  assert.match(formSource, /result\.approvalReset/);
  assert.match(formSource, /もう一度確認を依頼してください/);
  assert.match(formSource, /warnings\.push\("公開サイトへの反映に失敗/);
  assert.match(formSource, /setWarning\(warnings\.join/);
});
