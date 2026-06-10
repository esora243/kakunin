import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTimetableGrid,
  sortTimetableClasses,
  normalizePeriod,
  slotKindOfPeriod,
  clampAttendanceWeight,
  filterByGrade,
} from "../lib/timetable-core";
import type { TimetableClassDto } from "../lib/timetable-dto";

function mockClass(
  id: string,
  title: string,
  day: "月" | "火" | "水" | "木" | "金",
  period: number,
  overrides: Partial<TimetableClassDto> = {},
): TimetableClassDto {
  return {
    id,
    classKey: `class-${id}`,
    title,
    instructor: "テスト教員",
    room: "テスト教室",
    location: "テスト場所",
    day,
    period,
    slotKind: slotKindOfPeriod(period),
    startsAt: "09:00",
    endsAt: "10:30",
    grade: null,
    academicYear: 2026,
    termNumber: 1,
    universityName: "テスト大学",
    isCuttable: false,
    attendanceWeight: 2,
    departmentName: null,
    departmentSummary: null,
    examMaterialsUrl: null,
    activityScope: null,
    sourceType: "manual",
    isOfficial: true,
    ...overrides,
  };
}

test("sortTimetableClasses orders classes by day, period, then title", () => {
  const mondaySecond = mockClass("2", "生理学", "月", 2);
  const mondayFirstB = mockClass("3", "組織学", "月", 1);
  const tuesdayFirst = mockClass("4", "薬理学", "火", 1);

  const sorted = sortTimetableClasses([tuesdayFirst, mondaySecond, mondayFirstB]);

  assert.deepEqual(sorted.map((item) => item.id), ["3", "2", "4"]);
});

test("buildTimetableGrid places classes by day and period", () => {
  const item = mockClass("class-1", "解剖学", "月", 1);
  const grid = buildTimetableGrid([item]);
  assert.equal(grid["月"][1].id, "class-1");
  assert.deepEqual(grid["火"], {});
});

test("normalizePeriod converts string/special tokens", () => {
  assert.equal(normalizePeriod(3), 3);
  assert.equal(normalizePeriod("4"), 4);
  assert.equal(normalizePeriod("special"), 99);
  assert.equal(normalizePeriod("lunch"), 7);
  assert.equal(normalizePeriod("after"), 8);
  assert.equal(normalizePeriod("放課後"), 8);
  assert.equal(normalizePeriod(undefined), 99);
});

test("slotKindOfPeriod maps periods to kinds", () => {
  assert.equal(slotKindOfPeriod(1), "regular");
  assert.equal(slotKindOfPeriod(6), "regular");
  assert.equal(slotKindOfPeriod(7), "lunch");
  assert.equal(slotKindOfPeriod(8), "after");
  assert.equal(slotKindOfPeriod(99), "regular");
});

test("clampAttendanceWeight clamps to 0..3", () => {
  assert.equal(clampAttendanceWeight(-1), 0);
  assert.equal(clampAttendanceWeight(0), 0);
  assert.equal(clampAttendanceWeight(1), 1);
  assert.equal(clampAttendanceWeight(2), 2);
  assert.equal(clampAttendanceWeight(3), 3);
  assert.equal(clampAttendanceWeight(99), 3);
  assert.equal(clampAttendanceWeight(undefined), 2);
});

test("filterByGrade returns matching grade or grade-less items", () => {
  const c1 = mockClass("1", "解剖学", "月", 1, { grade: 1 });
  const c2 = mockClass("2", "病理学", "月", 2, { grade: 2 });
  const cAll = mockClass("3", "共通講義", "月", 3, { grade: null });
  const result = filterByGrade([c1, c2, cAll], 1);
  assert.deepEqual(result.map((c) => c.id), ["1", "3"]);
});
