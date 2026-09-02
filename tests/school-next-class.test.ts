import assert from "node:assert/strict";
import test from "node:test";
import { emptyTimetableGrid, findNextTimetableClass } from "../app/school/school-workspace-shared";
import type { TimetableClassDto } from "../lib/timetable-dto";

function item(id: string, day: TimetableClassDto["day"], period: number, startsAt: string): TimetableClassDto { return { id, classKey: id, title: id, instructor: null, room: null, location: null, day, period, startsAt, endsAt: null, academicYear: null, termNumber: null, universityName: null, sourceType: "test", isOfficial: true }; }

test("next class chooses the next remaining class today before later weekdays", () => { const grid = emptyTimetableGrid(); grid.月[1] = item("past", "月", 1, "09:00"); grid.月[3] = item("next", "月", 3, "13:00"); grid.火[1] = item("tomorrow", "火", 1, "09:00"); assert.equal(findNextTimetableClass(grid, new Date("2026-07-13T11:00:00+09:00"))?.id, "next"); });
test("next class wraps to the next week and returns null for an empty grid", () => { const grid = emptyTimetableGrid(); grid.月[1] = item("monday", "月", 1, "09:00"); assert.equal(findNextTimetableClass(grid, new Date("2026-07-17T18:00:00+09:00"))?.id, "monday"); assert.equal(findNextTimetableClass(emptyTimetableGrid(), new Date()), null); });
