import type {
  Job,
  FAQ,
  StudyAbroadProgram,
  StudentGroup,
  Article,
  Sponsor,
  Campaign,
  TimetableCell,
} from "./types";

// ===== 本番投入用データ =====
// ダミーデータは削除済みです。
// 運用時は以下の配列へ実データを投入してください。

export const allJobs: Job[] = [];
export const jobCategories = ["すべて"];

export const allFaqs: FAQ[] = [];
export const faqCategories = ["すべて"];

export const studentGroups: StudentGroup[] = [];
export const studyAbroadPrograms: StudyAbroadProgram[] = [];
export const activityArticles: Article[] = [];
export const schoolArticles: Article[] = [];
export const allCampaigns: Campaign[] = [];
export const allSponsors: Sponsor[] = [];

// ===== プロフィール登録ステップ =====
export const profileGenderOptions = ["男性", "女性", "その他", "回答しない"];
export const profileGradeOptions = ["1年生", "2年生", "3年生", "4年生", "5年生", "6年生", "その他"];
export const profileClubOptions = ["運動部", "文化部", "医療系サークル", "その他", "所属していない"];
export const profileSpecialtyOptions = [
  "内科",
  "外科",
  "小児科",
  "産婦人科",
  "整形外科",
  "精神科",
  "皮膚科",
  "眼科",
  "耳鼻咽喉科",
  "その他",
  "未定",
];

// ===== 学校データ =====
export const timetableDays = ["月", "火", "水", "木", "金"];
export const timetableDates = ["6", "7", "8", "9", "10"];
export const timetableGrid: Record<string, Record<number, TimetableCell>> = {};
