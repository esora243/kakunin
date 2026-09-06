import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { isCurrentTimetableRequest } from "../app/school/school-workspace-shared";
import {
  buildUserTimetableResponse,
  canAccessTimetableClass,
  mapUserTimetableEntryRow,
  parseTimetableClassIdBody,
  type UserTimetableEntryRow,
} from "../lib/timetable-requests";

function entryRow(overrides: Partial<UserTimetableEntryRow> = {}): UserTimetableEntryRow {
  return {
    id: "entry-1",
    created_at: "2026-05-10T00:00:00.000Z",
    color_label: null,
    display_order: null,
    syllabus_class_entries: {
      id: "class-1",
      class_key: "hmu-2026-1-mon-1",
      title: "解剖学",
      instructor: "山田 太郎",
      room: "講義室A",
      location: "浜松",
      schedule: { day: "月", period: 1, starts_at: "08:40", ends_at: "10:10" },
      source_type: "official_pdf",
      is_official: true,
      syllabus_pages: {
        academic_year: 2026,
        term_number: 1,
        universities: { name: "浜松医科大学" },
        university_id: "univ-1",
      },
    },
    ...overrides,
  };
}

test("personal timetable access checks reject cross-university classes", () => {
  assert.equal(
    canAccessTimetableClass(
      { university_id: "univ-1" },
      { syllabus_pages: { university_id: "univ-1" } },
    ),
    true,
  );
  assert.equal(
    canAccessTimetableClass(
      { university_id: "univ-1" },
      { syllabus_pages: { university_id: "univ-2" } },
    ),
    false,
  );
});

test("personal timetable SQL stays session-user scoped and active-class only", () => {
  const source = readFileSync(join(process.cwd(), "lib/personal-timetable.ts"), "utf8");

  assert.match(source, /ute\.user_id = \$1/);
  assert.match(source, /ute\.is_active = true/);
  assert.match(source, /sce\.is_active = true/);
  assert.match(source, /sp\.is_active = true/);
  assert.match(source, /on conflict \(user_id, syllabus_class_entry_id\)/);
  assert.match(source, /where user_id = \$1\s+and syllabus_class_entry_id = \$2\s+and is_active = true/);
});

test("public timetable SQL only exposes official active class rows", () => {
  const source = readFileSync(join(process.cwd(), "lib/timetable.ts"), "utf8");

  assert.match(source, /sce\.is_active = true/);
  assert.match(source, /sp\.is_active = true/);
  assert.match(source, /sce\.is_official = true/);
});

test("personal timetable add checks same-university access before upsert", () => {
  const source = readFileSync(join(process.cwd(), "lib/personal-timetable.ts"), "utf8");
  const accessCheck = source.indexOf("canAccessTimetableClass(user, classRow)");
  const upsert = source.indexOf("insert into user_timetable_entries");

  assert.ok(accessCheck > -1);
  assert.ok(upsert > -1);
  assert.ok(accessCheck < upsert);
});

test("personal timetable list filters existing cross-university rows", () => {
  const source = readFileSync(join(process.cwd(), "lib/personal-timetable.ts"), "utf8");
  const rowsRead = source.indexOf("from user_timetable_entries ute");
  const listAccessCheck = source.indexOf("canAccessTimetableClass(user, classRow)");
  const mapRows = source.indexOf(".map(mapUserTimetableEntryRow)");

  assert.ok(rowsRead > -1);
  assert.ok(listAccessCheck > -1);
  assert.ok(mapRows > -1);
  assert.ok(rowsRead < listAccessCheck);
  assert.ok(listAccessCheck < mapRows);
  assert.equal(
    mapUserTimetableEntryRow(entryRow({
      syllabus_class_entries: {
        ...entryRow().syllabus_class_entries as NonNullable<UserTimetableEntryRow["syllabus_class_entries"]>,
        syllabus_pages: { academic_year: 2026, term_number: 1, university_id: "univ-2", universities: { name: "Other" } },
      },
    }))?.class.universityName,
    "Other",
  );
  assert.equal(
    canAccessTimetableClass(
      { university_id: "univ-1" },
      { syllabus_pages: { university_id: "univ-2" } },
    ),
    false,
  );
});

test("personal timetable rows map into entries and grid without exposing raw table rows", () => {
  const entry = mapUserTimetableEntryRow(entryRow());
  assert.ok(entry);

  const response = buildUserTimetableResponse([entry]);

  assert.equal(response.entries[0].id, "entry-1");
  assert.equal(response.entries[0].classId, "class-1");
  assert.equal(response.items[0].id, "class-1");
  assert.equal(response.grid["月"][1].id, "class-1");
});

test("personal timetable routes require a session before personal data access", () => {
  const listRoute = readFileSync(join(process.cwd(), "app/api/me/timetable/route.ts"), "utf8");
  const itemRoute = readFileSync(join(process.cwd(), "app/api/me/timetable/classes/[classId]/route.ts"), "utf8");
  assert.match(listRoute, /sessionJsonRoute/);
  assert.match(listRoute, /guardedSessionJsonBodyRoute/);
  assert.match(listRoute, /listUserTimetableForSession/);
  assert.match(listRoute, /addUserTimetableClassForSession/);
  assert.match(itemRoute, /guardedSessionJsonRoute/);
  assert.match(itemRoute, /removeUserTimetableClassForSession/);
  assert.doesNotMatch(listRoute, /route-handlers/);
  assert.doesNotMatch(itemRoute, /route-handlers/);
});

test("personal timetable routes preserve inactive class and remove-missing contracts", () => {
  const listRoute = readFileSync(join(process.cwd(), "app/api/me/timetable/route.ts"), "utf8");
  const itemRoute = readFileSync(join(process.cwd(), "app/api/me/timetable/classes/[classId]/route.ts"), "utf8");

  assert.equal(parseTimetableClassIdBody({ classId: "inactive-class" }), "inactive-class");
  assert.equal(parseTimetableClassIdBody({}), null);
  assert.match(listRoute, /notFoundResult\("Class is not available"\)/);
  assert.match(itemRoute, /\{ body: \{ ok: true, removed: true \} \}/);
});

test("personal timetable ignores stale request IDs and responses from a previous user", () => {
  const currentAuth = { authHydrated: true, isLoggedIn: true, userId: "user-2" };

  assert.equal(isCurrentTimetableRequest({
    requestId: 4,
    currentRequestId: 5,
    requestUserId: "user-2",
    currentAuth,
  }), false);
  assert.equal(isCurrentTimetableRequest({
    requestId: 5,
    currentRequestId: 5,
    requestUserId: "user-1",
    currentAuth,
  }), false);
  assert.equal(isCurrentTimetableRequest({
    requestId: 5,
    currentRequestId: 5,
    requestUserId: "user-2",
    currentAuth,
  }), true);
});

test("personal timetable mutation feedback stays scoped to the initiating user", () => {
  const source = readFileSync(join(process.cwd(), "app/school/SchoolWorkspaceClient.tsx"), "utf8");

  assert.match(source, /if \(!isLoggedIn \|\| !userId\)/);
  assert.match(source, /const mutationUserId = userId/);
  assert.match(
    source,
    /catch \(error\) \{[\s\S]*?currentAuth\.userId !== mutationUserId\) return;[\s\S]*?toast\.error/,
  );
});
