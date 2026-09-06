import type { Metadata } from "next";
import { listCachedTimetableClasses } from "@/lib/public-cache";
import type { TimetableClassDto, TimetableDay } from "@/lib/timetable-dto";
import { SchoolPageClient } from "@/app/school/SchoolPageClient";

export const metadata: Metadata = {
  title: "学校",
  description: "時間割とシラバスをまとめて確認できます。",
};

export default async function SchoolPage() {
  let initialSharedClasses: TimetableClassDto[] = [];
  let initialDays: TimetableDay[] = ["月", "火", "水", "木", "金"];
  let initialPeriods = [1, 2, 3, 4, 5, 6];
  let initialSharedClassesError: string | null = null;

  try {
    const timetable = await listCachedTimetableClasses();
    initialSharedClasses = timetable.items;
    initialDays = timetable.days;
    initialPeriods = timetable.periods;
  } catch {
    initialSharedClassesError = "授業データの取得に失敗しました";
  }

  return (
    <SchoolPageClient
      initialSharedClasses={initialSharedClasses}
      initialDays={initialDays}
      initialPeriods={initialPeriods}
      initialSharedClassesError={initialSharedClassesError}
    />
  );
}
