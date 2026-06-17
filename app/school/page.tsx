"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar, Clock, ChevronRight, ChevronLeft, Menu, Loader2,
  X, Save, Edit2, MapPin, ClipboardList, ExternalLink, Video, Check,
  Search, ArrowLeft, Tag, Share2, Plus, MoreVertical, RefreshCcw,
  GraduationCap, Stethoscope, BookOpen, AlertCircle,
} from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";
// AuthContext には profile が無いため、localStorage の登録情報から読み取る
function useProfileFromStorage() {
  const [profile, setProfile] = useState<{ university?: string; grade?: string } | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("hugmeid_profile");
      if (raw) setProfile(JSON.parse(raw));
    } catch {
      /* noop */
    }
  }, []);
  return profile;
}

// =============================================================
// 型定義（拡張）
// =============================================================
type ClassData = {
  id: string;
  title: string;
  category: string;
  day: string;
  date: string;
  /** 1〜6 / 7=昼 / 8=放課後 / 99=特別 */
  period: number;
  periodLabel: string;
  room: string;
  professor: string;
  timeStart: string;
  timeEnd: string;
  timeDisplay: string;

  // 拡張: 出席運用
  isCuttable: boolean;
  attendanceWeight: 0 | 1 | 2 | 3;

  // 拡張: 診療科
  departmentName?: string | null;
  departmentSummary?: string | null;
  examMaterialsUrl?: string | null;

  // 学年（フィルタ用）
  grade?: number | null;

  // 課題メモ・通知タブを廃止 → コマ内に直接メモを持たせる
  notes?: string | null;
};

type ArticleData = {
  id: string;
  title: string;
  category: string;
  date: string;
  image: string;
  excerpt: string;
  content: string;
};

type CampaignData = {
  id: string;
  title: string;
  imageUrl: string;
  sponsorName: string;
};

// =============================================================
// 表示用カラースキーマ
//   attendanceWeight に応じて背景色を変える要件に対応。
//   isCuttable=true → グレーアウト気味
//   weight 3        → 強調
// =============================================================
function getCellStyle(opts: { isCuttable: boolean; attendanceWeight: number; category: string }) {
  const { isCuttable, attendanceWeight, category } = opts;

  if (isCuttable) {
    // 切ってもOK扱い: 薄いグレー
    return {
      border: "border-gray-200",
      bg: "bg-gray-100/70",
      text: "text-gray-500",
      ring: "",
    };
  }

  if (attendanceWeight >= 3) {
    // 必須コマ: 赤系で目立たせる
    return {
      border: "border-red-300",
      bg: "bg-red-50",
      text: "text-red-700",
      ring: "ring-1 ring-red-200",
    };
  }
  if (attendanceWeight === 2) {
    // カテゴリ別の標準カラー
    return categoryStyle(category);
  }
  if (attendanceWeight === 1) {
    // 軽め: 薄いブルー
    return {
      border: "border-sky-200",
      bg: "bg-sky-50",
      text: "text-sky-700",
      ring: "",
    };
  }
  // 0 はほぼ自由参加扱い
  return {
    border: "border-gray-200",
    bg: "bg-white",
    text: "text-gray-600",
    ring: "",
  };
}

function categoryStyle(category: string) {
  switch (category) {
    case "形態系":
    case "病理":
      return { border: "border-orange-200", bg: "bg-orange-50", text: "text-orange-700", ring: "" };
    case "機能系":
      return { border: "border-blue-300", bg: "bg-blue-50", text: "text-blue-700", ring: "" };
    case "生化学":
      return { border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-700", ring: "" };
    case "臨床":
      return { border: "border-teal-200", bg: "bg-teal-50", text: "text-teal-700", ring: "" };
    default:
      return { border: "border-gray-200", bg: "bg-gray-50", text: "text-gray-700", ring: "" };
  }
}

function autoDetectCategory(subject: string): string {
  if (!subject) return "default";
  if (subject.includes("病理") || subject.includes("解剖")) return "形態系";
  if (subject.includes("薬理") || subject.includes("生理")) return "機能系";
  if (subject.includes("生化学")) return "生化学";
  if (subject.includes("臨床") || subject.includes("PBL") || subject.includes("内科学") || subject.includes("外科学")) return "臨床";
  if (subject.includes("内科") || subject.includes("外科") || subject.includes("小児") || subject.includes("産婦")) return "臨床";
  return "default";
}

const DAYS = ["月", "火", "水", "木", "金"];
/** UI 行: 1〜6 限 + 昼休み + 放課後 */
const ROW_PERIODS: { value: number; label: string }[] = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
  { value: 6, label: "6" },
  { value: 7, label: "昼" },
  { value: 8, label: "放" },
];

function getWeekDates(baseDate: Date) {
  const d = new Date(baseDate);
  const dayOfWeek = d.getDay();
  const diffToMonday = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diffToMonday));
  return Array.from({ length: 5 }).map((_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd;
  });
}

function formatYYYYMMDD(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function FloatingBanner({ title, imageUrl, sponsorName }: { title: string, imageUrl: string, sponsorName: string }) {
  return (
    <div className="mx-4 mt-2 mb-4 rounded-xl overflow-hidden relative h-24 shadow-sm border border-gray-100">
      <img src={imageUrl || "https://images.unsplash.com/photo-1758691462848-ba1e929da259?auto=format&fit=crop&q=80&w=1080"} alt={title} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent p-4 flex flex-col justify-center">
        <span className="text-[10px] text-orange-300 font-bold mb-1">{sponsorName}</span>
        <h3 className="text-white text-sm font-bold leading-tight">{title}</h3>
      </div>
    </div>
  );
}

// =============================================================
// メインページ
// =============================================================
export default function SchoolPage() {
  const router = useRouter();
  const profile = useProfileFromStorage();

  const [view, setView] = useState<"main" | "classDetail" | "articleDetail">("main");
  const [activeTab, setActiveTab] = useState<"timetable" | "syllabus" | "articles">("timetable");

  // データ
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [articles, setArticles] = useState<ArticleData[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);

  // 学年（ログイン情報 or 手動切替）
  const initialGrade = (() => {
    const g = (profile?.grade ?? "").toString();
    const m = g.match(/(\d)/);
    return m ? Number(m[1]) : 1;
  })();
  const [selectedGrade, setSelectedGrade] = useState<number>(initialGrade);
  const universityName = profile?.university || "浜松医科大学";

  // 選択
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<ArticleData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("すべて");

  // 編集
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ClassData>>({});
  const [isSaving, setIsSaving] = useState(false);

  // 診療科モーダル
  const [departmentModal, setDepartmentModal] = useState<ClassData | null>(null);

  // 日付
  const [currentDate, setCurrentDate] = useState(new Date());
  const weekDates = useMemo(() => getWeekDates(new Date(currentDate)), [currentDate]);

  const handlePrevWeek = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };
  const handleNextWeek = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  // データ取得（拡張 API /api/timetable を利用）
  const fetchAllData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    else setIsSyncing(true);

    try {
      const [tt, artRes, campRes] = await Promise.all([
        fetch(`/api/timetable?grade=${selectedGrade}&university=${encodeURIComponent(universityName)}`, { cache: "no-store" })
          .then((r) => r.json())
          .catch(() => ({ ok: false, items: [] })),
        supabaseRestFetch<any>({ path: "articles?select=*" }).catch(() => []),
        supabaseRestFetch<any>({ path: "campaigns?select=*" }).catch(() => []),
      ]);

      const rawArticles = Array.isArray(artRes) ? artRes : artRes?.data || [];
      const rawCampaigns = Array.isArray(campRes) ? campRes : campRes?.data || [];

      // 時間割 → ClassData
      if (tt?.ok && Array.isArray(tt.items)) {
        const items: ClassData[] = tt.items.map((c: any) => {
          const cat = autoDetectCategory(c.title || "");
          const periodLabel: string = tt.periodLabels?.[c.period] || String(c.period);
          return {
            id: String(c.id),
            title: c.title || "（科目名なし）",
            category: cat,
            day: c.day,
            date: "",
            period: Number(c.period) || 99,
            periodLabel,
            room: c.room || "",
            professor: c.instructor || "",
            timeStart: c.startsAt || "",
            timeEnd: c.endsAt || "",
            timeDisplay:
              c.startsAt && c.endsAt ? `${c.startsAt} - ${c.endsAt}` : c.startsAt || c.endsAt || "時間未設定",
            isCuttable: !!c.isCuttable,
            attendanceWeight: (c.attendanceWeight ?? 2) as 0 | 1 | 2 | 3,
            departmentName: c.departmentName || null,
            departmentSummary: c.departmentSummary || null,
            examMaterialsUrl: c.examMaterialsUrl || null,
            grade: c.grade ?? null,
            notes: c.notes || null,
          };
        });
        setClasses(items);
      }

      setArticles(
        rawArticles.map((a: any) => ({
          id: String(a.id),
          title: a.title || "タイトルなし",
          category: a.category || "一般",
          date: a.date || a.created_at?.split("T")[0] || "",
          image:
            a.image_url ||
            a.image ||
            "https://images.unsplash.com/photo-1576091160550-2173ff9e5ee5?auto=format&fit=crop&q=80&w=600",
          excerpt: a.excerpt || a.description || "",
          content: a.content || a.body || "本文がありません。",
        })),
      );

      setCampaigns(
        rawCampaigns.map((c: any) => ({
          id: String(c.id),
          title: c.title || "",
          imageUrl: c.image_url || c.image || "",
          sponsorName: c.sponsor_name || c.sponsor || "",
        })),
      );
    } finally {
      if (showLoading) setLoading(false);
      setIsSyncing(false);
    }
  }, [selectedGrade, universityName]);

  useEffect(() => {
    fetchAllData(true);
    const interval = setInterval(() => fetchAllData(false), 15000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  // 記事フィルタ
  const categories = ["すべて", ...Array.from(new Set(articles.map((a) => a.category)))];
  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const matchQuery =
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = selectedCategory === "すべて" || article.category === selectedCategory;
      return matchQuery && matchCategory;
    });
  }, [searchQuery, selectedCategory, articles]);

  const handleStartEdit = async () => {
    if (!selectedClass) return;
    setIsEditing(true);
    setEditForm(selectedClass);
  };

  const handleSaveClass = async () => {
    if (!selectedClass) return;
    setIsSaving(true);
    try {
      const formatTime = (timeStr?: string) =>
        timeStr ? (timeStr.length === 5 ? `${timeStr}:00` : timeStr) : null;

      await supabaseRestFetch<any>({
        path: `timetable_classes?id=eq.${selectedClass.id}`,
        method: "PATCH",
        body: {
          subject: editForm.title,
          room: editForm.room,
          teacher: editForm.professor,
          time_start: formatTime(editForm.timeStart),
          time_end: formatTime(editForm.timeEnd),
          period: editForm.period,
          is_cuttable: editForm.isCuttable ?? false,
          attendance_weight: editForm.attendanceWeight ?? 2,
          department_name: editForm.departmentName ?? null,
          department_summary: editForm.departmentSummary ?? null,
          exam_materials_url: editForm.examMaterialsUrl ?? null,
          notes: editForm.notes ?? null,
        },
      });
      await fetchAllData(false);
      setSelectedClass((prev) => (prev ? ({ ...prev, ...editForm } as ClassData) : null));
      setIsEditing(false);
    } catch {
      alert("保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  // =============================================================
  // 編集画面
  // =============================================================
  if (view === "classDetail" && selectedClass && isEditing) {
    return (
      <div className="w-full max-w-lg mx-auto bg-white min-h-screen pb-20">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 bg-white/90 backdrop-blur-md border-b border-gray-100">
          <button onClick={() => setIsEditing(false)} className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 hover:bg-gray-50">
            <X size={20} className="text-gray-600" />
          </button>
          <h2 className="text-lg font-bold text-gray-800">授業の編集</h2>
          <div className="w-10 h-10" />
        </div>

        <div className="px-5 pt-6 space-y-5">
          <FormRow label="授業名">
            <input type="text" value={editForm.title || ""} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className={INPUT_CLS} />
          </FormRow>

          <div className="grid grid-cols-2 gap-4">
            <FormRow label="開始時間">
              <input type="time" value={editForm.timeStart || ""} onChange={(e) => setEditForm({ ...editForm, timeStart: e.target.value })} className={INPUT_CLS} />
            </FormRow>
            <FormRow label="終了時間">
              <input type="time" value={editForm.timeEnd || ""} onChange={(e) => setEditForm({ ...editForm, timeEnd: e.target.value })} className={INPUT_CLS} />
            </FormRow>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormRow label="教室">
              <input type="text" value={editForm.room || ""} onChange={(e) => setEditForm({ ...editForm, room: e.target.value })} className={INPUT_CLS} />
            </FormRow>
            <FormRow label="時限枠">
              <select value={editForm.period ?? 1} onChange={(e) => setEditForm({ ...editForm, period: Number(e.target.value) })} className={INPUT_CLS}>
                {ROW_PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>{p.value <= 6 ? `${p.value}限` : p.value === 7 ? "昼休み" : "放課後"}</option>
                ))}
                <option value={99}>特別枠</option>
              </select>
            </FormRow>
          </div>

          <FormRow label="担当教員">
            <input type="text" value={editForm.professor || ""} onChange={(e) => setEditForm({ ...editForm, professor: e.target.value })} className={INPUT_CLS} />
          </FormRow>

          {/* 拡張: 出席運用 */}
          <div className="grid grid-cols-2 gap-4">
            <FormRow label="出席必須度">
              <select value={editForm.attendanceWeight ?? 2} onChange={(e) => setEditForm({ ...editForm, attendanceWeight: Number(e.target.value) as 0 | 1 | 2 | 3 })} className={INPUT_CLS}>
                <option value={0}>0 (自由)</option>
                <option value={1}>1 (軽め)</option>
                <option value={2}>2 (標準)</option>
                <option value={3}>3 (必須)</option>
              </select>
            </FormRow>
            <FormRow label="切り可">
              <label className="flex items-center gap-2 px-4 py-3 border border-gray-200 rounded-xl bg-gray-50">
                <input type="checkbox" checked={!!editForm.isCuttable} onChange={(e) => setEditForm({ ...editForm, isCuttable: e.target.checked })} className="w-4 h-4" />
                <span className="text-sm font-bold text-gray-700">切ってもOK</span>
              </label>
            </FormRow>
          </div>

          {/* 拡張: 診療科 */}
          <FormRow label="診療科名">
            <input type="text" value={editForm.departmentName || ""} onChange={(e) => setEditForm({ ...editForm, departmentName: e.target.value })} className={INPUT_CLS} placeholder="例: 循環器内科" />
          </FormRow>
          <FormRow label="診療科の概要">
            <textarea rows={3} value={editForm.departmentSummary || ""} onChange={(e) => setEditForm({ ...editForm, departmentSummary: e.target.value })} className={`${INPUT_CLS} resize-y`} />
          </FormRow>
          <FormRow label="試験資料 URL">
            <input type="url" value={editForm.examMaterialsUrl || ""} onChange={(e) => setEditForm({ ...editForm, examMaterialsUrl: e.target.value })} className={INPUT_CLS} placeholder="https://..." />
          </FormRow>

          {/* メモ・通知統合 */}
          <FormRow label="メモ・通知（旧タブ統合）">
            <textarea rows={4} value={editForm.notes || ""} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className={`${INPUT_CLS} resize-y`} placeholder="課題・連絡事項・通知などを一括で記入" />
          </FormRow>

          <div className="pt-6 pb-10">
            <button onClick={handleSaveClass} disabled={isSaving} className="w-full flex items-center justify-center gap-2 py-4 bg-orange-500 text-white rounded-xl font-bold shadow-sm hover:bg-orange-600 transition-colors disabled:opacity-50">
              {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} 保存して完了
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =============================================================
  // 詳細画面
  // =============================================================
  if (view === "classDetail" && selectedClass) {
    return (
      <div className="w-full max-w-lg mx-auto bg-white min-h-screen pb-20">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 bg-white/90 backdrop-blur-md border-b border-gray-100">
          <button onClick={() => setView("main")} className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 hover:bg-gray-50">
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <h2 className="text-lg font-bold text-gray-800">授業の詳細</h2>
          <button className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 hover:bg-gray-50">
            <MoreVertical size={20} className="text-gray-600" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 text-xs rounded-full font-bold border border-blue-100">
              {selectedClass.category === "default" ? "一般講義" : selectedClass.category}
            </span>
            <span className={`inline-block px-3 py-1 text-xs rounded-full font-bold border ${weightBadge(selectedClass.attendanceWeight)}`}>
              出席度 {selectedClass.attendanceWeight}
            </span>
            {selectedClass.isCuttable && (
              <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-bold border border-gray-200">切り可</span>
            )}
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-3">{selectedClass.title}</h1>
          <p className="text-sm text-gray-700 mb-6 font-medium">
            {selectedClass.day}・{selectedClass.periodLabel} {selectedClass.timeDisplay} {selectedClass.room} {selectedClass.professor}
          </p>

          {/* 課題メモ・通知タブを廃止し、一目で見えるようにインライン表示 */}
          <h3 className="font-bold text-sm text-gray-800 mb-3">授業情報</h3>
          <div className="bg-gray-50 rounded-2xl p-4 mb-4">
            <InfoRow icon={<Clock size={14} />} label="時間" value={selectedClass.timeDisplay} />
            <InfoRow icon={<Calendar size={14} />} label="日付" value={selectedClass.date ? selectedClass.date.replace(/-/g, "/") : "毎週"} />
            <InfoRow icon={<MapPin size={14} />} label="教室" value={selectedClass.room || "未設定"} />
            <InfoRow icon={<Video size={14} />} label="Zoom URL" value="（登録なし）" valueClass="text-blue-500" />
          </div>

          {/* 診療科ブロック */}
          {(selectedClass.departmentName || selectedClass.departmentSummary || selectedClass.examMaterialsUrl) && (
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 rounded-2xl p-4 mb-4">
              <h3 className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-2">
                <Stethoscope size={14} className="text-orange-500" /> 診療科情報
              </h3>
              {selectedClass.departmentName && (
                <button
                  onClick={() => setDepartmentModal(selectedClass)}
                  className="text-sm font-bold text-orange-600 underline mb-2"
                >
                  {selectedClass.departmentName}
                </button>
              )}
              {selectedClass.departmentSummary && (
                <p className="text-xs text-gray-700 leading-relaxed mb-3 line-clamp-3">{selectedClass.departmentSummary}</p>
              )}
              {selectedClass.examMaterialsUrl && (
                <a href={selectedClass.examMaterialsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-bold text-orange-600 underline">
                  試験資料を開く <ExternalLink size={12} />
                </a>
              )}
            </div>
          )}

          {/* メモ・通知（旧2タブを統合） */}
          {selectedClass.notes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-4">
              <h3 className="font-bold text-sm text-gray-800 mb-2 flex items-center gap-2">
                <AlertCircle size={14} className="text-yellow-600" /> メモ・通知
              </h3>
              <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedClass.notes}</p>
            </div>
          )}

          <div className="flex gap-3 mb-8">
            <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-600 text-sm font-bold hover:bg-blue-100 transition-colors">
              <Video size={16} /> Zoomを開く
            </button>
            <button
              onClick={handleStartEdit}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-300 text-gray-700 text-sm font-bold hover:bg-gray-50 transition-colors"
            >
              <Edit2 size={16} /> 編集する
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =============================================================
  // 記事詳細
  // =============================================================
  if (view === "articleDetail" && selectedArticle) {
    return (
      <div className="min-h-screen bg-white pb-20">
        <div className="w-full max-w-lg mx-auto">
          <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-orange-100 px-4 py-3 flex items-center gap-3">
            <button onClick={() => setView("main")} className="text-gray-600 hover:text-orange-500">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-base font-bold text-gray-800 flex-1 truncate">記事詳細</h1>
            <button className="text-gray-400 hover:text-orange-500"><Share2 size={20} /></button>
          </div>

          <div className="w-full h-64 bg-gray-100">
            <img src={selectedArticle.image} alt={selectedArticle.title} className="w-full h-full object-cover" />
          </div>

          <div className="px-4 py-6 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full flex items-center gap-1">
                <Tag size={12} />{selectedArticle.category}
              </span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Calendar size={12} />{selectedArticle.date.replace(/-/g, "/")}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 leading-tight">{selectedArticle.title}</h1>
          </div>

          <div className="px-4 py-6 prose prose-sm max-w-none">
            {selectedArticle.content.split("\n\n").map((paragraph, idx) => {
              if (paragraph.startsWith("## ")) {
                return <h2 key={idx} className="text-lg font-bold text-gray-800 mt-6 mb-3">{paragraph.replace("## ", "")}</h2>;
              }
              return <p key={idx} className="text-sm text-gray-700 leading-relaxed mb-4">{paragraph}</p>;
            })}
          </div>
        </div>
      </div>
    );
  }

  // =============================================================
  // メインビュー
  // =============================================================
  return (
    <div className="w-full max-w-lg mx-auto pb-8 bg-white min-h-screen">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-4">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-gray-800">学校</h2>
            {isSyncing && <RefreshCcw size={14} className="text-gray-400 animate-spin" />}
          </div>
          <div className="flex gap-2">
            <button className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"><Plus size={16} /></button>
            <button className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"><Menu size={16} /></button>
          </div>
        </div>

        {/* 大学名・学年セレクタ */}
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-500">
            <GraduationCap size={14} className="text-orange-500" />
            {universityName}
          </span>
          <span className="text-gray-300">&gt;</span>
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(Number(e.target.value))}
            className="px-2 py-1 text-xs font-bold border border-orange-200 rounded-md bg-orange-50 text-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-200"
          >
            {[1, 2, 3, 4, 5, 6].map((g) => (
              <option key={g} value={g}>{g}年生</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          <button onClick={() => setActiveTab("timetable")} className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "timetable" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-orange-50"}`}>📅 時間割</button>
          <button onClick={() => setActiveTab("syllabus")} className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "syllabus" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-orange-50"}`}>📋 シラバス</button>
          <button onClick={() => setActiveTab("articles")} className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "articles" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-orange-50"}`}>📚 勉強系記事</button>
        </div>
      </div>

      {campaigns.length > 0 && (
        <FloatingBanner title={campaigns[0].title} imageUrl={campaigns[0].imageUrl} sponsorName={campaigns[0].sponsorName} />
      )}

      <div className="px-3 pt-1">
        {activeTab === "timetable" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2 mb-2">
              <button onClick={handlePrevWeek} className="p-1"><ChevronLeft size={20} className="text-gray-400 hover:text-gray-700" /></button>
              <span className="font-bold text-gray-800 text-sm">
                {currentDate.getFullYear()}年{currentDate.getMonth() + 1}月 第{Math.ceil((currentDate.getDate() + (new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() || 7) - 1) / 7)}週
              </span>
              <button onClick={handleNextWeek} className="p-1"><ChevronRight size={20} className="text-gray-400 hover:text-gray-700" /></button>
            </div>

            <div className="bg-white">
              <div className="grid grid-cols-[28px_1fr_1fr_1fr_1fr_1fr] gap-1 mb-2">
                <div></div>
                {weekDates.map((date, i) => {
                  const isToday = formatYYYYMMDD(date) === formatYYYYMMDD(new Date());
                  return (
                    <div key={i} className="text-center flex flex-col items-center">
                      {isToday ? (
                        <>
                          <span className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">{date.getDate()}</span>
                          <span className="text-orange-500 text-[10px] mt-0.5 font-bold">{DAYS[i]}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-gray-800 text-xs font-bold h-6 flex items-center justify-center">{date.getDate()}</span>
                          <span className="text-gray-500 text-[10px] mt-0.5">{DAYS[i]}</span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={30} /></div>
              ) : (
                ROW_PERIODS.map((row) => {
                  const isLunch = row.value === 7;
                  const isAfter = row.value === 8;
                  return (
                    <div key={row.value} className="grid grid-cols-[28px_1fr_1fr_1fr_1fr_1fr] gap-1 mb-1">
                      <div className={`flex flex-col items-center justify-center text-[10px] ${isLunch ? "text-amber-500" : isAfter ? "text-purple-500" : "text-gray-400"}`}>
                        <span className="font-bold">{row.label}</span>
                        {!isLunch && !isAfter && <span className="scale-75">限</span>}
                      </div>
                      {weekDates.map((date, i) => {
                        const dayStr = DAYS[i];
                        const cell = classes.find((c) => c.period === row.value && c.day === dayStr);

                        if (!cell) {
                          // 昼休み / 放課後の空セルは薄く色付け
                          const emptyBg = isLunch
                            ? "bg-amber-50/40 border-amber-100"
                            : isAfter
                            ? "bg-purple-50/40 border-purple-100"
                            : "border-gray-100 bg-gray-50/30";
                          return <div key={i} className={`border rounded-md min-h-[60px] ${emptyBg}`}></div>;
                        }

                        const style = getCellStyle({
                          isCuttable: cell.isCuttable,
                          attendanceWeight: cell.attendanceWeight,
                          category: cell.category,
                        });

                        return (
                          <div
                            key={i}
                            onClick={() => { setSelectedClass(cell); setView("classDetail"); }}
                            className={`relative border rounded-md p-1.5 min-h-[60px] flex flex-col cursor-pointer hover:opacity-80 transition-opacity ${style.bg} ${style.border} ${style.text} ${style.ring}`}
                          >
                            {/* 診療科名をクリックでモーダル */}
                            {cell.departmentName ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); setDepartmentModal(cell); }}
                                className="text-left font-bold text-[10px] leading-tight whitespace-pre-line tracking-tight underline decoration-dotted underline-offset-2"
                              >
                                {cell.departmentName}
                              </button>
                            ) : (
                              <span className="font-bold text-[10px] leading-tight whitespace-pre-line tracking-tight">{cell.title}</span>
                            )}
                            {cell.room && <span className="text-[8px] mt-1 opacity-70 leading-tight block">{cell.room}</span>}

                            {cell.notes && (
                              <div className="absolute bottom-1 left-1 flex gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" title="メモあり" />
                              </div>
                            )}
                            {cell.attendanceWeight >= 3 && (
                              <div className="absolute top-1 right-1">
                                <span className="text-[8px] font-bold text-red-600">必</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            {/* 凡例 */}
            <div className="flex flex-wrap gap-x-3 gap-y-2 text-[9px] mt-6 px-2 justify-center text-gray-600">
              <span className="flex items-center gap-1"><span className="w-2 h-2 border border-red-300 bg-red-50"></span>必須(出席度3)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 border border-blue-300 bg-blue-50"></span>標準</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 border border-sky-200 bg-sky-50"></span>軽め</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 border border-gray-200 bg-gray-100"></span>切り可</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-100 border border-amber-300"></span>昼休み</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-purple-100 border border-purple-300"></span>放課後</span>
              <span className="flex items-center gap-1 ml-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>メモあり</span>
            </div>
          </div>
        )}

        {activeTab === "syllabus" && (
          <div className="space-y-4">
            <div className="bg-white p-8 sm:p-12 rounded-2xl border border-gray-100 shadow-sm text-center">
              <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-5">
                <ClipboardList size={36} strokeWidth={2} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">公式シラバスシステム</h3>
              <p className="text-sm text-gray-500 mb-8 leading-relaxed font-medium">
                大学のセキュリティ設定により、アプリ内での直接表示が制限されています。<br className="hidden sm:block" />
                以下のボタンから、安全なブラウザの別タブでシラバスを開いてください。
              </p>
              <a href="https://lcu.hama-med.ac.jp/lcu-web/SC_06001B00_21" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#4e72ba] text-white rounded-xl font-bold shadow-sm hover:bg-blue-700 transition-colors w-full sm:w-auto text-sm">
                シラバスシステムを開く <ExternalLink size={18} />
              </a>
            </div>
          </div>
        )}

        {activeTab === "articles" && (
          <div className="space-y-4">
            <div className="relative px-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input type="text" placeholder="記事を検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 sm:text-sm transition-colors" />
            </div>

            <div className="flex gap-2 overflow-x-auto px-1 pb-1 [&::-webkit-scrollbar]:hidden">
              {categories.map((category) => (
                <button key={category} onClick={() => setSelectedCategory(category)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${selectedCategory === category ? "bg-gray-800 border-gray-800 text-white" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                  {category}
                </button>
              ))}
            </div>

            <div className="space-y-3 pb-6">
              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-orange-500" size={30} /></div>
              ) : filteredArticles.length > 0 ? (
                filteredArticles.map((article) => (
                  <div key={article.id} onClick={() => { setSelectedArticle(article); setView("articleDetail"); }} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex hover:shadow-md transition-shadow cursor-pointer">
                    <img src={article.image} alt={article.title} className="w-28 h-28 object-cover shrink-0" />
                    <div className="p-3 flex flex-col justify-center min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-orange-500 font-bold px-1.5 py-0.5 bg-orange-50 rounded-sm">{article.category}</span>
                        <span className="text-[10px] text-gray-400">{article.date.replace(/-/g, "/")}</span>
                      </div>
                      <h4 className="text-sm font-bold text-gray-800 line-clamp-2 mb-1 leading-tight">{article.title}</h4>
                      <p className="text-xs text-gray-500 line-clamp-2 leading-tight">{article.excerpt}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <p className="text-gray-500 text-sm font-bold">記事が登録されていません</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 診療科モーダル */}
      {departmentModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => setDepartmentModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-md shadow-xl animate-in slide-in-from-bottom-4 fade-in duration-200 overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Stethoscope size={16} className="text-orange-500" /> 診療科情報
              </h3>
              <button onClick={() => setDepartmentModal(null)} className="text-gray-400 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-5 space-y-4">
              <h4 className="text-xl font-bold text-gray-900">{departmentModal.departmentName}</h4>
              {departmentModal.departmentSummary ? (
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {departmentModal.departmentSummary}
                </p>
              ) : (
                <p className="text-sm text-gray-500 italic">概要は未登録です。</p>
              )}
              {departmentModal.examMaterialsUrl && (
                <a
                  href={departmentModal.examMaterialsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 transition-colors"
                >
                  <BookOpen size={16} /> 試験資料を開く <ExternalLink size={14} />
                </a>
              )}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-gray-500 mb-1">担当</div>
                  <div className="font-bold text-gray-800">{departmentModal.professor || "—"}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-gray-500 mb-1">場所</div>
                  <div className="font-bold text-gray-800">{departmentModal.room || "—"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================
// 補助コンポーネント
// =============================================================
const INPUT_CLS =
  "w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 font-bold focus:bg-white focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all";

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function InfoRow({ icon, label, value, valueClass }: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex py-2 border-b border-gray-200 last:border-b-0">
      <div className="w-24 text-xs text-gray-600 flex items-center gap-2">{icon} {label}</div>
      <div className={`text-xs font-medium ${valueClass || "text-gray-800"}`}>{value}</div>
    </div>
  );
}

function weightBadge(w: number) {
  if (w >= 3) return "bg-red-50 text-red-700 border-red-200";
  if (w === 2) return "bg-blue-50 text-blue-700 border-blue-200";
  if (w === 1) return "bg-sky-50 text-sky-700 border-sky-200";
  return "bg-gray-50 text-gray-600 border-gray-200";
}
