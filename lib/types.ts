// ===== 共通型定義 =====

export type UserProfile = {
  gender: string;
  grade: string;
  university: string;
  club: string;
  specialty: string;
};

export type FilterOptions = {
  employmentType: string[];
  jobType: string[];
  prefecture: string[];
  salaryMin: string;
};

export type Job = {
  id: number;
  title: string;
  employmentType: string;
  jobType: string;
  prefecture: string;
  location: string;
  salary: number;
  salaryDisplay: string;
  schedule: string;
  company: string;
  companyType: string;
  requirements?: string;
  summary?: string;
  description?: string;
  postedAt?: string;
  applyUrl?: string;
  requirementsList?: string[];
  benefits?: string[];
};

export type FAQ = {
  id: number;
  category: string;
  question: string;
  answer: string;
};

export type StudyAbroadProgram = {
  id: number;
  title: string;
  country: string;
  duration: string;
  image: string;
  organization: string;
  deadline: string;
  url?: string;
};

export type StudentGroup = {
  id: number;
  name: string;
  category: string;
  image: string;
  description: string;
  members: number;
  social: { instagram: string; twitter: string; mail: string };
  url?: string;
};

/**
 * 記事の型定義。
 * - id は string / number 両対応（article.json はハイフン付き文字列、Supabase は数値）。
 * - 「お気に入り」「学習法」フィルタリングのため category と type を必ず持たせる。
 */
export type Article = {
  id: string | number;
  /** "school" = 学習系 / "activity" = 課外活動系 */
  type?: "school" | "activity";
  title: string;
  /** 表示用カテゴリ。"学習法" は固定フィルタタブから参照される */
  category: string;
  date: string;
  image: string;
  excerpt?: string;
  content?: string;
  url?: string;
  author?: string;
  tags?: string[];
};

export type SponsorTier = "platinum" | "gold" | "supporter";

export type Sponsor = {
  id: string;
  name: string;
  logo: string;
  bannerImage?: string;
  description: string;
  category: string;
  url: string;
  tier: SponsorTier;
  products?: Array<{ name: string; description: string; image: string }>;
  video?: { title: string; thumbnail: string; duration: string };
};

export type Campaign = {
  id: string;
  title: string;
  company: string;
  img: string;
  description: string;
  tag: string;
  date: string;
  time: string;
  location: string;
  capacity: string;
  target: string;
  entryUrl?: string;
  benefits?: string[];
};

/**
 * 保存（お気に入り）対象。
 * - "article" を追加し、記事のお気に入り保存を可能にする。
 */
export type SavedItemType = "job" | "campaign" | "article";

export type SavedEntry = {
  type: SavedItemType;
  id: string;
  savedAt: string;
};

export type TimetableCell = {
  title: string;
  room?: string;
  style: string;
  dots?: string[];
};
