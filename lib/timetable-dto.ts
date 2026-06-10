export type TimetableDay = "月" | "火" | "水" | "木" | "金" | "土" | "日";

/**
 * 時限種別
 * - "regular"  : 通常の1〜6限
 * - "lunch"    : 昼休み枠（学内活動を入れられる）
 * - "after"    : 放課後枠（学外活動・課外活動を入れられる）
 */
export type SlotKind = "regular" | "lunch" | "after";

/**
 * 出席優先度。
 * - 0  : 切っても問題ない（自習扱い）
 * - 1  : 一応出席（軽め）
 * - 2  : 標準
 * - 3  : 必須（落単リスク・出席点が大きい）
 */
export type AttendanceWeight = 0 | 1 | 2 | 3;

/**
 * 時間割の1コマ。
 * 既存 (id, title, day, period, etc.) に加え、要件で追加された
 * 拡張プロパティを含む。
 */
export type TimetableClassDto = {
  id: string;
  classKey: string;
  title: string;
  instructor: string | null;
  room: string | null;
  location: string | null;
  day: TimetableDay;
  /** 1〜6 = 通常 / 7 = 昼休み / 8 = 放課後 / 99 = 特別枠（旧 "special"） */
  period: number;
  slotKind: SlotKind;
  startsAt: string | null;
  endsAt: string | null;

  // === 学年・大学・学期 ===
  /** 1〜6 年生 */
  grade: number | null;
  academicYear: number | null;
  termNumber: number | null;
  /** 例: "浜松医科大学" */
  universityName: string | null;

  // === 出席運用 ===
  /** true なら切ってもよい授業（背景色を弱める） */
  isCuttable: boolean;
  /** 出席必須度 0〜3 */
  attendanceWeight: AttendanceWeight;

  // === 診療科情報（クリックでモーダル表示） ===
  /** 例: "循環器内科" */
  departmentName?: string | null;
  /** 診療科の概要・実習で見るポイント等 */
  departmentSummary?: string | null;
  /** 過去問・試験対策資料へのリンク */
  examMaterialsUrl?: string | null;

  // === 課外活動の連携 ===
  /** カレンダー上での種別（学内 / 学外） */
  activityScope?: "intramural" | "extramural" | null;

  sourceType: string;
  isOfficial: boolean;
};

export type TimetableGridDto = Record<TimetableDay, Record<number, TimetableClassDto>>;

export type TimetableResponse = {
  ok: true;
  days: TimetableDay[];
  periods: number[];
  /** 表示用の各 period ラベル ("1限", "昼", "放課後" など) */
  periodLabels: Record<number, string>;
  items: TimetableClassDto[];
  grid: TimetableGridDto;
  /** 取得対象の学年 */
  grade: number | null;
  universityName: string | null;
};
