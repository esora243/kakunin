import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTimetableGrid,
  sortTimetableClasses,
} from "../lib/timetable-core";
import type { TimetableClassDto } from "../lib/timetable-dto";

function mockClass(id: string, title: string, day: "月"|"火"|"水"|"木"|"金", period: number): TimetableClassDto {
  return {
    id,
    classKey: `class-${id}`,
    title,
    instructor: "テスト教員",
    room: "テスト教室",
    location: "テスト場所",
    day,
    period,
    startsAt: "09:00",
    endsAt: "10:30",
    academicYear: 2026,
    termNumber: 1,
    universityName: "テスト大学",
    sourceType: "manual",
    isOfficial: true,
  };
}

test("sortTimetableClasses orders classes by day, period, then title", () => {
  const mondaySecond = mockClass("2", "生理学", "月", 2);
  const mondayFirstB = mockClass("3", "組織学", "月", 1);
  const tuesdayFirst = mockClass("4", "薬理学", "火", 1);

  const sorted = sortTimetableClasses([tuesdayFirst, mondaySecond, mondayFirstB]);

  assert.deepEqual(
    sorted.map((item) => item.id),
    ["3", "2", "4"],
  );
});

test("buildTimetableGrid places classes by day and period", () => {
  const item = mockClass("class-1", "解剖学", "月", 1);

  const grid = buildTimetableGrid([item]);

  assert.equal(grid["月"][1].id, "class-1");
  assert.deepEqual(grid["火"], {});
});