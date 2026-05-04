import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTimetableGrid,
  mapTimetableClass,
  readSchedule,
  sortTimetableClasses,
  type SyllabusClassRow,
} from "../lib/timetable-core";

function row(overrides: Partial<SyllabusClassRow> = {}): SyllabusClassRow {
  return {
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
    },
    ...overrides,
  };
}

test("readSchedule accepts valid day and period values", () => {
  assert.deepEqual(readSchedule({ day: "月", period: 1, starts_at: "08:40", ends_at: "10:10" }), {
    day: "月",
    period: 1,
    startsAt: "08:40",
    endsAt: "10:10",
  });
  assert.equal(readSchedule({ weekday: "火", period: 2 })?.day, "火");
});

test("readSchedule rejects malformed schedules", () => {
  assert.equal(readSchedule(null), null);
  assert.equal(readSchedule([]), null);
  assert.equal(readSchedule({ day: "日", period: 1 }), null);
  assert.equal(readSchedule({ day: "月", period: "1" }), null);
  assert.equal(readSchedule({ day: "月", period: 0 }), null);
});

test("mapTimetableClass maps Supabase REST relation shape to DTO", () => {
  assert.deepEqual(mapTimetableClass(row()), {
    id: "class-1",
    classKey: "hmu-2026-1-mon-1",
    title: "解剖学",
    instructor: "山田 太郎",
    room: "講義室A",
    location: "浜松",
    day: "月",
    period: 1,
    startsAt: "08:40",
    endsAt: "10:10",
    academicYear: 2026,
    termNumber: 1,
    universityName: "浜松医科大学",
    sourceType: "official_pdf",
    isOfficial: true,
  });
});

test("mapTimetableClass drops rows without a usable schedule", () => {
  assert.equal(mapTimetableClass(row({ schedule: { day: "月", period: "1" } })), null);
});

test("sortTimetableClasses orders classes by day, period, then title", () => {
  const mondaySecond = mapTimetableClass(row({ id: "2", title: "生理学", schedule: { day: "月", period: 2 } }));
  const mondayFirstB = mapTimetableClass(row({ id: "3", title: "組織学", schedule: { day: "月", period: 1 } }));
  const tuesdayFirst = mapTimetableClass(row({ id: "4", title: "薬理学", schedule: { day: "火", period: 1 } }));

  const sorted = sortTimetableClasses([tuesdayFirst, mondaySecond, mondayFirstB].filter((item) => item !== null));

  assert.deepEqual(
    sorted.map((item) => item.id),
    ["3", "2", "4"],
  );
});

test("buildTimetableGrid places classes by day and period", () => {
  const item = mapTimetableClass(row());
  assert.ok(item);

  const grid = buildTimetableGrid([item]);

  assert.equal(grid["月"][1].id, "class-1");
  assert.deepEqual(grid["火"], {});
});
