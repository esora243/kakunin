import type { TimetableClassDto, TimetableDay, TimetableGridDto } from "@/lib/timetable-dto";

export type SchoolWorkspaceTab = "timetable" | "syllabus" | "shared";
export type SchoolWorkspaceView = "main" | "detail";
export type SchoolClassSource = "personal" | "shared";
export type TimetableAuthSnapshot = {
  authHydrated: boolean;
  isLoggedIn: boolean;
  userId: string | null;
};

export function isCurrentTimetableRequest({
  requestId,
  currentRequestId,
  requestUserId,
  currentAuth,
  cancelled = false,
}: {
  requestId: number;
  currentRequestId: number;
  requestUserId: string;
  currentAuth: TimetableAuthSnapshot;
  cancelled?: boolean;
}) {
  return (
    !cancelled &&
    requestId === currentRequestId &&
    currentAuth.authHydrated &&
    currentAuth.isLoggedIn &&
    currentAuth.userId === requestUserId
  );
}

export const DAY_ACCENTS: Record<TimetableDay, string> = {
  月: "border-subtle bg-brand-50 text-brand-700",
  火: "border-strong bg-brand-100 text-brand-700",
  水: "border-subtle bg-brand-50 text-brand-600",
  木: "border-strong bg-brand-100 text-brand-700",
  金: "border-subtle bg-brand-50 text-brand-600",
  土: "border-subtle bg-surface-inset text-secondary",
  日: "border-subtle bg-surface-inset text-secondary",
};

export function emptyTimetableGrid(): TimetableGridDto {
  return { 月: {}, 火: {}, 水: {}, 木: {}, 金: {}, 土: {}, 日: {} };
}

export function formatClassTime(item: TimetableClassDto) {
  if (!item.startsAt || !item.endsAt) return `${item.period}限`;
  return `${item.period}限 ${item.startsAt}-${item.endsAt}`;
}

// ==========================================
// ▼ 追加：時間割UI用のステータス・スタイル・日付計算 ▼
// ==========================================

// 課題/小テスト/試験は「重さ」に意味があるので semantic トークンを使う。
export const STATUS_DOTS = [
  { key: "assignment", label: "課題", className: "bg-info-500" },
  { key: "quiz", label: "小テスト", className: "bg-warning-500" },
  { key: "exam", label: "試験", className: "bg-danger-500" },
] as const;

/**
 * 科目分類の配色。
 * Tailwind 既定の red/blue/purple/emerald を直接使うと brand ランプと無関係な
 * 6 色パレットが 1 画面に同居してしまうため、navy と調和する categorical
 * トークン (accent.1〜5) に寄せている。
 */
export const SUBJECT_CATEGORY_STYLES = {
  anatomy: {
    label: "解剖・組織",
    bg: "bg-accent-1-50",
    border: "border-accent-1-100",
    text: "text-accent-1-700",
    dot: "bg-accent-1-500",
  },
  physiology: {
    label: "生理・薬理",
    bg: "bg-accent-2-50",
    border: "border-accent-2-100",
    text: "text-accent-2-700",
    dot: "bg-accent-2-500",
  },
  biochem: {
    label: "生化・遺伝",
    bg: "bg-accent-3-50",
    border: "border-accent-3-100",
    text: "text-accent-3-700",
    dot: "bg-accent-3-500",
  },
  pathology: {
    label: "病理・免疫",
    bg: "bg-accent-4-50",
    border: "border-accent-4-100",
    text: "text-accent-4-700",
    dot: "bg-accent-4-500",
  },
  clinical: {
    label: "臨床・公衆",
    bg: "bg-accent-5-50",
    border: "border-accent-5-100",
    text: "text-accent-5-700",
    dot: "bg-accent-5-500",
  },
  other: {
    label: "その他",
    bg: "bg-surface-inset",
    border: "border-subtle",
    text: "text-secondary",
    dot: "bg-brand-200",
  },
} as const;

export function classifySubject(title: string): keyof typeof SUBJECT_CATEGORY_STYLES {
  if (/解剖|組織|発生|肉眼/i.test(title)) return "anatomy";
  if (/生理|薬理|神経/i.test(title)) return "physiology";
  if (/生化|分子|遺伝/i.test(title)) return "biochem";
  if (/病理|免疫|微生物|感染/i.test(title)) return "pathology";
  if (/内科|外科|公衆衛生|法医|臨床/i.test(title)) return "clinical";
  return "other";
}

// カレンダーの「〇月〇日の週」ラベルを生成する関数
export function formatWeekLabel(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日の週`;
}

const jsDayToTimetableDay: TimetableDay[] = ["日", "月", "火", "水", "木", "金", "土"];

const japanDateTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Tokyo",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const weekdayToTimetableDay: Record<string, TimetableDay> = {
  Sun: "日", Mon: "月", Tue: "火", Wed: "水", Thu: "木", Fri: "金", Sat: "土",
};

function classStartMinutes(item: TimetableClassDto) {
  const match = item.startsAt?.match(/^(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 8 * 60 + item.period * 60;
}

export function findNextTimetableClass(grid: TimetableGridDto, now: Date): TimetableClassDto | null {
  const parts = Object.fromEntries(japanDateTime.formatToParts(now).map(({ type, value }) => [type, value]));
  const today = weekdayToTimetableDay[parts.weekday];
  const todayIndex = jsDayToTimetableDay.indexOf(today);
  const nowMinutes = Number(parts.hour) * 60 + Number(parts.minute);
  const candidates: Array<{ offset: number; start: number; item: TimetableClassDto }> = [];
  for (const [day, periods] of Object.entries(grid) as Array<[TimetableDay, Record<number, TimetableClassDto>]>) {
    const dayIndex = jsDayToTimetableDay.indexOf(day);
    const offset = (dayIndex - todayIndex + 7) % 7;
    for (const item of Object.values(periods)) {
      const start = classStartMinutes(item);
      if (offset === 0 && start < nowMinutes) continue;
      candidates.push({ offset, start, item });
    }
  }
  candidates.sort((a, b) => a.offset - b.offset || a.start - b.start);
  return candidates[0]?.item ?? null;
}

// 基準日からその週の各曜日の日付を計算する関数
export function getWeekDates(referenceDate: Date, days: TimetableDay[]): Record<string, Date> {
  const result: Record<string, Date> = {};
  const base = new Date(referenceDate);
  const dayOfWeek = base.getDay(); // 0: 日曜, 1: 月曜, ...
  
  // 月曜日を週の始まりとして計算
  const diff = base.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(base.setDate(diff));

  const dayMap: Record<TimetableDay, number> = { "月": 0, "火": 1, "水": 2, "木": 3, "金": 4, "土": 5, "日": 6 };
  
  days.forEach((d) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + dayMap[d]);
    result[d] = date;
  });
  
  return result;
}
