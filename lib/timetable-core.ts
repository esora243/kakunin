import type {
  AttendanceWeight,
  SlotKind,
  TimetableClassDto,
  TimetableDay,
  TimetableGridDto,
} from "./timetable-dto";

export const TIMETABLE_DAYS: TimetableDay[] = ["月", "火", "水", "木", "金"];
export const DAY_ORDER = new Map<TimetableDay, number>(
  TIMETABLE_DAYS.map((day, index) => [day, index]),
);

/**
 * 表示順の period 番号。
 * 1〜6 : 通常コマ
 * 7    : 昼休み枠（学内活動）
 * 8    : 放課後枠（学外・課外活動）
 * 99   : 特別枠（祝日特別講義など、互換維持）
 *
 * これまで "7" を special としていた旧仕様は 99 へ移行。
 * （課題メモ・通知タブを廃止し、すべて時間割側にまとめる方針）
 */
export const PERIODS: number[] = [1, 2, 3, 4, 5, 6, 7, 8];

export const PERIOD_LABELS: Record<number, string> = {
  1: "1限",
  2: "2限",
  3: "3限",
  4: "4限",
  5: "5限",
  6: "6限",
  7: "昼", // 昼休み
  8: "放課後",
  99: "特別",
};

/** 旧 "special" 文字列 → 99 へ正規化 */
export function normalizePeriod(raw: unknown): number {
  if (typeof raw === "number" && !Number.isNaN(raw)) return raw;
  if (typeof raw === "string") {
    if (raw === "special" || raw === "特別" || raw === "特") return 99;
    if (raw === "lunch" || raw === "昼") return 7;
    if (raw === "after" || raw === "放課後") return 8;
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n)) return n;
  }
  return 99;
}

/** 期から SlotKind を算出 */
export function slotKindOfPeriod(period: number): SlotKind {
  if (period === 7) return "lunch";
  if (period === 8) return "after";
  return "regular";
}

/** AttendanceWeight を 0〜3 に丸める */
export function clampAttendanceWeight(v: unknown): AttendanceWeight {
  const n = typeof v === "number" ? v : parseInt(String(v ?? "2"), 10);
  if (Number.isNaN(n)) return 2;
  if (n <= 0) return 0;
  if (n === 1) return 1;
  if (n === 2) return 2;
  return 3;
}

export function sortTimetableClasses(items: TimetableClassDto[]) {
  return [...items].sort((a, b) => {
    const dayDiff = (DAY_ORDER.get(a.day) ?? 99) - (DAY_ORDER.get(b.day) ?? 99);
    if (dayDiff !== 0) return dayDiff;
    if (a.period !== b.period) return a.period - b.period;
    return a.title.localeCompare(b.title, "ja");
  });
}

export function buildTimetableGrid(items: TimetableClassDto[]) {
  const grid = Object.fromEntries(TIMETABLE_DAYS.map((day) => [day, {}])) as TimetableGridDto;
  for (const item of items) {
    // 【修正箇所】月〜金以外のデータ（土曜日や空欄など）が来た場合はスキップしてクラッシュを防ぐ
    if (!grid[item.day]) {
      continue;
    }
    grid[item.day][item.period] = item;
  }
  return grid;
}

/** 学年でフィルタ。grade が null の項目（全学年共通）も対象。 */
export function filterByGrade(items: TimetableClassDto[], grade: number | null) {
  if (!grade) return items;
  return items.filter((c) => c.grade == null || c.grade === grade);
}