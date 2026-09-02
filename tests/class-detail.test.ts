import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  canAccessClass,
  mapMemoRow,
  mapResourceRow,
  mapTagRow,
  mapTaskRow,
  parseMemoBody,
  parseResourceBody,
  parseTagsBody,
  parseTaskBody,
  parseTaskStatusBody,
} from "../lib/class-detail-requests";

test("class detail access checks require an active class page from the same university", () => {
  assert.equal(
    canAccessClass(
      { id: "user-1", university_id: "univ-1", deactivated_at: null },
      { id: "class-1", syllabus_pages: { university_id: "univ-1", is_active: true } },
    ),
    true,
  );
  assert.equal(
    canAccessClass(
      { id: "user-1", university_id: "univ-1", deactivated_at: null },
      { id: "class-1", syllabus_pages: { university_id: "univ-2", is_active: true } },
    ),
    false,
  );
});

test("class detail SQL stays active-page and own-user scoped", () => {
  const source = readFileSync(join(process.cwd(), "lib/class-detail.ts"), "utf8");

  assert.match(source, /sce\.is_active = true/);
  assert.match(source, /sp\.is_active = true/);
  assert.match(source, /where user_id = \$1\s+and syllabus_class_entry_id = \$2/);
  assert.match(source, /created_by_user_id,\s+updated_by_user_id/);
  assert.match(source, /values \(\$1, \$2, \$3\)/);
  assert.match(source, /insert into user_class_task_statuses \(user_id, syllabus_class_task_id, status, completed_at\)/);
});

test("class detail rows map to DTOs without raw ownership fields", () => {
  assert.deepEqual(
    mapResourceRow({
      id: "resource-1",
      resource_type: "material_url",
      title: null,
      url: "https://example.com/material",
      created_at: "2026-05-10T00:00:00.000Z",
      updated_at: "2026-05-10T00:00:00.000Z",
    }),
    {
      id: "resource-1",
      type: "material_url",
      title: null,
      url: "https://example.com/material",
      createdAt: "2026-05-10T00:00:00.000Z",
      updatedAt: "2026-05-10T00:00:00.000Z",
    },
  );
  assert.equal(mapTaskRow({ id: "task-1", title: "課題", description: null, due_at: null, created_at: "c", updated_at: "u", user_class_task_statuses: { status: "todo" } }).status, "todo");
  assert.deepEqual(mapMemoRow("class-1", null), { classId: "class-1", body: "", updatedAt: null });
  assert.equal(mapTagRow({ id: "tag-1", syllabus_class_entry_id: "class-1", label: "重要", color: null, created_at: "c", updated_at: "u" }).classId, "class-1");
});

test("class detail body parsers reject invalid inputs", () => {
  assert.equal(parseResourceBody({ type: "zoom_url", url: "javascript:alert(1)" }).ok, false);
  assert.equal(parseTaskStatusBody({ status: "done" }).ok, false);
  assert.equal(parseTaskBody({ title: "課題", dueAt: "2026-05-10T09:00" }).ok, false);
});

test("class detail body parsers reject unsafe or oversized user content", () => {
  assert.equal(parseResourceBody({ type: "material_url", title: "Material", url: "http://example.com/insecure" }).ok, false);
  assert.equal(parseTaskBody({ title: "x".repeat(121) }).ok, false);
  assert.equal(parseMemoBody({ body: "x".repeat(5001) }).ok, false);
  assert.equal(parseTagsBody({ tags: [{ label: "valid", color: "red" }] }).ok, false);
});

test("class task dueAt requires an explicit timezone before normalization", () => {
  const parsed = parseTaskBody({ title: "課題", dueAt: "2026-05-10T09:00:00+09:00" });

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.dueAt, "2026-05-10T00:00:00.000Z");
});

test("class detail routes call services directly and require a session", () => {
  const routes = [
    "app/api/syllabus/classes/[classId]/resources/route.ts",
    "app/api/syllabus/classes/[classId]/tasks/route.ts",
    "app/api/me/class-memos/[classId]/route.ts",
    "app/api/me/class-tags/[classId]/route.ts",
    "app/api/me/class-task-statuses/[taskId]/route.ts",
  ];
  for (const route of routes) {
    const source = readFileSync(join(process.cwd(), route), "utf8");
    assert.match(source, /sessionJsonRoute|guardedSessionJsonBodyRoute/);
    assert.doesNotMatch(source, /route-handlers/);
  }
});
