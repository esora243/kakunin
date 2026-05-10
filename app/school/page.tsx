"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import {
  Calendar,
  Clock,
  ChevronRight,
  ChevronLeft,
  Menu,
  BookOpen,
  Plus,
  Loader2,
  Building2,
  ClipboardList,
  Search,
  MoreVertical,
  MapPin,
  Video,
  Edit2,
  CheckSquare,
  Square,
} from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";
import { FloatingBanner } from "@/components/FloatingBanner";
import { siteConfig } from "@/lib/site";

// =============================================================
// 型定義 (要件定義書 / 技術スタック書 DB スキーマ準拠)
// =============================================================
type ClassTask = {
  id: string;
  title: string;
  deadline: string;
  completed: boolean;
  days_left?: number;
};

type ClassData = {
  id: string;
  title: string;
  category: string;
  day: string;
  periods: number[];
  room: string;
  professor?: string;
  timeDisplay?: string;
  term?: string;
  zoomUrl?: string;
  hasZoom?: boolean;
  hasNotice?: boolean;
  hasTask?: boolean;
  tasks?: ClassTask[];
};

// =============================================================
// 教科カテゴリの色定義
// (Hugmeid mock の School.tsx で使用されているパレットに合わせる)
// =============================================================
const CATEGORY_STYLES: Record<
  string,
  { border: string; bg: string; text: string; pill: string }
> = {
  形態系: { border: "border-orange-200", bg: "bg-orange-50", text: "text-orange-700", pill: "bg-orange-50 text-orange-600 border-orange-100" },
  機能系: { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-700", pill: "bg-blue-50 text-blue-600 border-blue-100" },
  生化学: { border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-700", pill: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  病理: { border: "border-orange-200", bg: "bg-orange-50", text: "text-orange-700", pill: "bg-orange-50 text-orange-600 border-orange-100" },
  臨床: { border: "border-teal-200", bg: "bg-teal-50", text: "text-teal-700", pill: "bg-teal-50 text-teal-600 border-teal-100" },
  default: { border: "border-gray-200", bg: "bg-gray-50/30", text: "text-gray-700", pill: "bg-gray-100 text-gray-600 border-gray-200" },
};

const DAYS = ["月", "火", "水", "木", "金"];
const PERIODS = [1, 2, 3, 4, 5, 6];

// =============================================================
// 日付ユーティリティ
// =============================================================
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

function getWeekOfMonthString(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const firstDay = new Date(year, month - 1, 1).getDay() || 7;
  const weekNumber = Math.ceil((date.getDate() + firstDay - 1) / 7);
  return `${year}年${month}月 第${weekNumber}週`;
}

// =============================================================
// 学校ページ
// - Hugmeid mock の Pages/School.tsx のレイアウト/タブ/FloatingBanner を反映
// - kakunin の Supabase 連携機能(timetable_classes / class_tasks) を保持
// =============================================================
export default function SchoolPage() {
  const [activeTab, setActiveTab] = useState<
    "timetable" | "syllabus" | "articles" | "hospitals" | "exam"
  >("timetable");

  const [loading, setLoading] = useState(true);

  // 将来的にログイン情報から取得する想定の所属情報
  const [userProfile] = useState({
    university: "山口大学",
    faculty: "医学部",
    grade: 3,
  });

  // 時間割データ
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const weekDates = useMemo(() => getWeekDates(new Date(currentDate)), [currentDate]);

  // 勉強系記事(検索・カテゴリ)
  const [articles, setArticles] = useState<any[]>([]);
  const [articleSearch, setArticleSearch] = useState("");
  const [articleCategory, setArticleCategory] = useState("すべて");
  const [articlesLoading, setArticlesLoading] = useState(false);

  // 時間割をDB(Supabase)から取得
  useEffect(() => {
    let cancelled = false;
    async function fetchClasses() {
      setLoading(true);
      try {
        const queryPath = `timetable_classes?university=eq.${encodeURIComponent(
          userProfile.university,
        )}&grade=eq.${userProfile.grade}&select=*,tasks:class_tasks(*)`;
        const res = await supabaseRestFetch<any[]>({ path: queryPath });
        if (!cancelled && Array.isArray(res)) {
          setClasses(
            res.map((c) => ({
              id: c.id,
              title: c.title,
              category: c.category || "default",
              day: c.day,
              periods: c.periods || [],
              room: c.room || "",
              professor: c.professor,
              timeDisplay: c.time_display,
              term: c.term,
              zoomUrl: c.zoom_url,
              hasZoom: !!c.zoom_url,
              hasNotice: c.has_notice,
              hasTask: c.tasks && c.tasks.length > 0,
              tasks: c.tasks || [],
            })),
          );
        }
      } catch (error) {
        console.error("時間割の取得に失敗しました:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchClasses();
    return () => {
      cancelled = true;
    };
  }, [userProfile]);

  // 記事タブの読み込み
  useEffect(() => {
    if (activeTab !== "articles") return;
    let cancelled = false;
    async function fetchArticles() {
      setArticlesLoading(true);
      try {
        const data = await supabaseRestFetch<any[]>({
          path: "articles?type=eq.school&select=*",
        });
        if (!cancelled) setArticles(data || []);
      } catch {
        if (!cancelled) setArticles([]);
      } finally {
        if (!cancelled) setArticlesLoading(false);
      }
    }
    void fetchArticles();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const articleCategories = useMemo(
    () => ["すべて", ...Array.from(new Set(articles.map((a) => a.category).filter(Boolean)))],
    [articles],
  );

  const filteredArticles = useMemo(() => {
    const q = articleSearch.trim().toLowerCase();
    return articles.filter((a) => {
      const title = (a.title || "").toLowerCase();
      const excerpt = (a.excerpt || "").toLowerCase();
      const matchQuery = !q || title.includes(q) || excerpt.includes(q);
      const matchCategory = articleCategory === "すべて" || a.category === articleCategory;
      return matchQuery && matchCategory;
    });
  }, [articles, articleSearch, articleCategory]);

  const handlePrevWeek = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 7);
    setCurrentDate(prev);
  };
  const handleNextWeek = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 7);
    setCurrentDate(next);
  };

  // ============================================================
  // 授業詳細ビュー(タップ時)
  // ============================================================
  const renderDetailView = () => {
    if (!selectedClass) return null;
    const style = CATEGORY_STYLES[selectedClass.category] || CATEGORY_STYLES.default;

    return (
      <div className="bg-white min-h-[800px] animate-fade-in pb-20">
        <div className="flex items-center justify-between px-4 py-4 mb-2">
          <button
            onClick={() => setSelectedClass(null)}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-base font-bold text-gray-800">授業の詳細</h2>
          <button className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
            <MoreVertical size={20} />
          </button>
        </div>

        <div className="px-6">
          <div
            className={`inline-block px-3 py-1 rounded-full text-xs font-bold border mb-4 ${style.pill}`}
          >
            {selectedClass.category}
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-3">{selectedClass.title}</h1>
          <p className="text-sm font-bold text-gray-600 mb-8">
            {selectedClass.day}・{selectedClass.periods.join("〜")}限{" "}
            {selectedClass.timeDisplay || "時間未設定"} {selectedClass.room}{" "}
            {selectedClass.professor || ""}
          </p>

          <div className="flex border-b border-gray-200 mb-6">
            <button className="flex-1 pb-3 text-sm font-bold text-orange-500 border-b-2 border-orange-500 text-center">
              基本情報
            </button>
            <button className="flex-1 pb-3 text-sm font-bold text-gray-400 hover:text-gray-600 text-center transition-colors">
              課題
            </button>
            <button className="flex-1 pb-3 text-sm font-bold text-gray-400 hover:text-gray-600 text-center transition-colors">
              メモ・通知
            </button>
          </div>

          <h3 className="text-sm font-bold text-gray-800 mb-4">授業情報</h3>
          <div className="bg-gray-50 rounded-2xl p-5 mb-6 space-y-4 border border-gray-100">
            <div className="flex items-center gap-4">
              <Clock size={16} className="text-gray-400" />
              <span className="text-sm text-gray-700">
                {selectedClass.timeDisplay || "時間未設定"}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Calendar size={16} className="text-gray-400" />
              <span className="text-sm text-gray-700">{selectedClass.term || "前期"}</span>
            </div>
            <div className="flex items-center gap-4">
              <MapPin size={16} className="text-gray-400" />
              <span className="text-sm text-gray-700">{selectedClass.room}</span>
            </div>
            {selectedClass.zoomUrl && (
              <div className="flex items-center gap-4">
                <Video size={16} className="text-gray-400" />
                <a
                  href={`https://${selectedClass.zoomUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-500 hover:underline"
                >
                  {selectedClass.zoomUrl}
                </a>
              </div>
            )}
          </div>

          {selectedClass.zoomUrl && (
            <div className="flex gap-3 mb-10">
              <button className="flex-1 py-3.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors">
                <Video size={18} /> Zoomを開く
              </button>
              <button className="flex-1 py-3.5 bg-white text-gray-600 border border-gray-200 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
                <Edit2 size={18} /> URLを編集
              </button>
            </div>
          )}

          <h3 className="text-sm font-bold text-gray-800 mb-4">課題</h3>
          <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
            {selectedClass.tasks && selectedClass.tasks.length > 0 ? (
              <div className="space-y-4">
                {selectedClass.tasks.map((task, idx) => (
                  <div
                    key={task.id}
                    className={`flex items-start gap-3 pb-4 ${
                      idx !== selectedClass.tasks!.length - 1
                        ? "border-b border-gray-200/60"
                        : ""
                    }`}
                  >
                    <button className="mt-0.5">
                      {task.completed ? (
                        <CheckSquare className="text-orange-300" size={20} />
                      ) : (
                        <Square className="text-orange-500" size={20} />
                      )}
                    </button>
                    <div>
                      <h4
                        className={`text-sm font-bold mb-1 ${
                          task.completed ? "text-gray-400 line-through" : "text-gray-800"
                        }`}
                      >
                        {task.title}
                      </h4>
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs ${
                            task.completed ? "text-gray-400" : "text-gray-500"
                          }`}
                        >
                          提出期限 : {task.deadline}
                        </span>
                        {task.completed ? (
                          <span className="text-xs text-gray-400">提出済み</span>
                        ) : task.days_left ? (
                          <span className="text-xs text-orange-500 font-bold">
                            （残り{task.days_left}日）
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">課題はありません</p>
            )}

            <button className="flex items-center gap-2 text-orange-500 font-bold text-sm mt-4 hover:text-orange-600 transition-colors">
              <Plus size={18} /> 課題を追加
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // 時間割グリッド
  // ============================================================
  const renderTimetableGrid = () => {
    const today = new Date();

    return (
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-orange-50 shadow-sm animate-fade-in overflow-x-auto">
        <div className="flex items-center justify-between mb-6 min-w-[500px]">
          <button
            onClick={handlePrevWeek}
            className="p-2 hover:bg-gray-50 rounded-full transition-colors"
          >
            <ChevronLeft size={24} className="text-gray-400" />
          </button>
          <h3 className="text-lg font-bold text-gray-800">
            {getWeekOfMonthString(currentDate)}
          </h3>
          <button
            onClick={handleNextWeek}
            className="p-2 hover:bg-gray-50 rounded-full transition-colors"
          >
            <ChevronRight size={24} className="text-gray-400" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-orange-500" size={40} />
          </div>
        ) : (
          <div className="min-w-[500px]">
            <div className="grid grid-cols-[30px_repeat(5,minmax(0,1fr))] gap-2 sm:gap-3 mb-4">
              <div />
              {weekDates.map((date, i) => {
                const isToday = date.toDateString() === today.toDateString();
                return (
                  <div key={i} className="text-center flex flex-col items-center">
                    <span
                      className={`text-base font-bold ${
                        isToday ? "text-orange-500" : "text-gray-800"
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    <div
                      className={`text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
                        isToday
                          ? "bg-orange-500 text-white shadow-sm"
                          : "text-gray-500"
                      }`}
                    >
                      {DAYS[i]}
                    </div>
                  </div>
                );
              })}
            </div>

            {PERIODS.map((period) => (
              <div
                key={period}
                className="grid grid-cols-[30px_repeat(5,minmax(0,1fr))] gap-2 sm:gap-3 mb-2 sm:mb-3"
              >
                <div className="flex flex-col items-center justify-center text-gray-400">
                  <span className="text-sm font-bold">{period}</span>
                  <span className="text-[10px] font-bold">限</span>
                </div>

                {DAYS.map((day) => {
                  const cellClass = classes.find(
                    (c) => c.day === day && c.periods.includes(period),
                  );
                  const isContinuation = cellClass && cellClass.periods[0] !== period;

                  if (!cellClass) {
                    return (
                      <div
                        key={`${day}-${period}`}
                        className="border border-gray-100 rounded-xl min-h-[90px] sm:min-h-[110px]"
                      />
                    );
                  }

                  const style =
                    CATEGORY_STYLES[cellClass.category] || CATEGORY_STYLES.default;

                  return (
                    <button
                      key={`${day}-${period}`}
                      onClick={() => setSelectedClass(cellClass)}
                      className={`relative border-2 rounded-xl p-2.5 sm:p-3 min-h-[90px] sm:min-h-[110px] flex flex-col text-left transition-transform hover:scale-[1.02] ${style.border} ${style.bg} ${
                        isContinuation ? "border-t-0 rounded-t-none opacity-80" : ""
                      }`}
                    >
                      <span
                        className={`font-bold text-[13px] sm:text-sm leading-tight ${style.text}`}
                      >
                        {isContinuation ? "(続き)" : cellClass.title}
                      </span>
                      {!isContinuation && cellClass.room && (
                        <span className="text-[10px] sm:text-[11px] mt-1 text-gray-400 font-bold">
                          {cellClass.room}
                        </span>
                      )}

                      {!isContinuation && (
                        <div className="absolute bottom-2 left-2.5 flex gap-1.5">
                          {cellClass.hasZoom && (
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" />
                          )}
                          {cellClass.hasNotice && (
                            <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm" />
                          )}
                          {cellClass.hasTask && (
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-700 shadow-sm" />
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}

            {/* 凡例 */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 mt-8 pt-6 border-t border-orange-50">
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <Square size={12} className="text-orange-200 fill-orange-50" /> 形態系
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <Square size={12} className="text-blue-200 fill-blue-50" /> 機能系
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <Square size={12} className="text-emerald-200 fill-emerald-50" /> 生化学
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <Square size={12} className="text-orange-200 fill-orange-50" /> 病理
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <Square size={12} className="text-teal-200 fill-teal-50" /> 臨床
              </div>
              <div className="w-px h-3 bg-gray-300 mx-1 hidden sm:block" />
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <div className="w-2 h-2 rounded-full bg-blue-500" /> Zoom
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <div className="w-2 h-2 rounded-full bg-orange-500" /> 通知
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <div className="w-2 h-2 rounded-full bg-amber-700" /> 課題
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================
  // メイン画面
  // ============================================================
  return (
    <div className="w-full max-w-4xl mx-auto bg-white min-h-screen font-sans">
      {/* ============================================================
          ヘッダー(タブ + 操作ボタン)
          - 詳細ビュー時は非表示にして集中表示
         ============================================================ */}
      {!selectedClass && (
        <div className="px-4 sm:px-6 py-5 border-b border-orange-50 sticky top-0 bg-white z-20">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">学校</h2>
            <div className="flex gap-2">
              <button className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors">
                <Plus size={18} strokeWidth={2} />
              </button>
              <button className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors">
                <Menu size={18} strokeWidth={2} />
              </button>
              <button className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors">
                <Clock size={18} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* タブ (Hugmeid mock の角丸ピル + emoji 表現を反映) */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            <TabButton
              active={activeTab === "timetable"}
              onClick={() => setActiveTab("timetable")}
              icon={<Calendar size={16} />}
              label="時間割"
            />
            <TabButton
              active={activeTab === "syllabus"}
              onClick={() => setActiveTab("syllabus")}
              icon={<ClipboardList size={16} />}
              label="シラバス"
            />
            <TabButton
              active={activeTab === "articles"}
              onClick={() => setActiveTab("articles")}
              icon={<BookOpen size={16} />}
              label="勉強系記事"
            />
            <TabButton
              active={activeTab === "hospitals"}
              onClick={() => setActiveTab("hospitals")}
              icon={<Building2 size={16} />}
              label="研修病院"
            />
            <TabButton
              active={activeTab === "exam"}
              onClick={() => setActiveTab("exam")}
              icon={<BookOpen size={16} />}
              label="国試対策"
            />
          </div>
        </div>
      )}

      {/* ============================================================
          FloatingBanner (Hugmeid mock 由来 - ヘッダー直下のフローティング広告)
          - selectedClass(詳細表示) 時は表示しない
         ============================================================ */}
      {!selectedClass && activeTab !== "syllabus" && (
        <div className="pt-3">
          <FloatingBanner
            campaignId="1"
            title="2026年度 初期研修説明会 受付中"
            imageUrl="https://images.unsplash.com/photo-1758691462848-ba1e929da259?auto=format&fit=crop&q=80&w=1080"
            sponsorName="医療法人伏見会　伏見病院"
          />
        </div>
      )}

      <div className={`bg-[#FFF9FA] ${!selectedClass ? "p-4 sm:p-6" : ""}`}>
        {/* === 時間割 === */}
        {activeTab === "timetable" &&
          (selectedClass ? renderDetailView() : renderTimetableGrid())}

        {/* === シラバス (要件定義書: OCR or 手動入力 / Phase1 浜松医科大のみ) === */}
        {activeTab === "syllabus" && !selectedClass && (
          <div className="bg-white rounded-2xl border border-orange-50 shadow-sm p-4 animate-fade-in">
            <div className="w-full h-[70vh] rounded-xl overflow-hidden border border-gray-200 shadow-sm relative bg-gray-50">
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-0">
                <Calendar className="text-gray-300 mb-2" size={32} />
                <p className="text-sm text-gray-500 font-bold mb-1">
                  シラバスを読み込んでいます...
                </p>
                {siteConfig.syllabusUrl ? (
                  <p className="text-xs text-gray-400">
                    表示されない場合は、
                    <a
                      href={siteConfig.syllabusUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 underline"
                    >
                      こちらからブラウザで開いて
                    </a>
                    ください。
                  </p>
                ) : (
                  <p className="text-xs text-gray-400">
                    シラバスURLが未設定です(NEXT_PUBLIC_SYLLABUS_URL)。
                  </p>
                )}
              </div>
              {siteConfig.syllabusUrl && (
                <iframe
                  src={siteConfig.syllabusUrl}
                  title="大学シラバス"
                  className="relative z-10 w-full h-full border-none bg-white"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              )}
            </div>
          </div>
        )}

        {/* === 勉強系記事 (検索 + カテゴリ) === */}
        {activeTab === "articles" && !selectedClass && (
          <div className="space-y-4 animate-fade-in">
            {/* 検索バー */}
            <div className="relative px-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="記事を検索..."
                value={articleSearch}
                onChange={(e) => setArticleSearch(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 sm:text-sm transition-colors"
              />
            </div>

            {/* カテゴリチップ */}
            <div className="flex gap-2 overflow-x-auto px-1 pb-1 hide-scrollbar">
              {articleCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => setArticleCategory(category)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                    articleCategory === category
                      ? "bg-gray-800 border-gray-800 text-white"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* リスト */}
            <div className="space-y-3 pb-6">
              {articlesLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-orange-500" size={32} />
                </div>
              ) : filteredArticles.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-orange-100">
                  <p className="text-gray-500 text-sm font-bold">
                    一致する記事が見つかりません
                  </p>
                  <button
                    onClick={() => {
                      setArticleSearch("");
                      setArticleCategory("すべて");
                    }}
                    className="mt-2 text-orange-500 text-xs font-bold underline"
                  >
                    検索条件をクリア
                  </button>
                </div>
              ) : (
                filteredArticles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/school/articles/${article.id}`}
                    className="block bg-white rounded-xl shadow-sm border border-orange-50 overflow-hidden flex hover:shadow-md transition-shadow"
                  >
                    <img
                      src={article.image_url || article.image}
                      alt={article.title}
                      className="w-28 h-28 object-cover shrink-0 bg-orange-50"
                    />
                    <div className="p-3 flex flex-col justify-center min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-orange-500 font-bold px-1.5 py-0.5 bg-orange-50 rounded-sm">
                          {article.category}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {(article.publish_date || article.date || "").replace(/-/g, "/")}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-gray-800 line-clamp-2 mb-1 leading-tight">
                        {article.title}
                      </h4>
                      <p className="text-xs text-gray-500 line-clamp-2 leading-tight">
                        {article.excerpt}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}

        {/* === 研修病院 (要件定義書 Phase 2 / 4年生以上向け プレースホルダ) === */}
        {activeTab === "hospitals" && !selectedClass && (
          <div className="bg-white rounded-2xl border border-orange-50 shadow-sm p-8 text-center animate-fade-in">
            <Building2 className="mx-auto text-orange-200 mb-3" size={40} />
            <p className="font-bold text-gray-800 mb-2">研修病院紹介(Phase 2機能)</p>
            <p className="text-sm text-gray-500">
              4年生以上向けに、病院見学マニュアル・病院一覧・各病院HPへの導線を
              <br />
              順次公開予定です。
            </p>
          </div>
        )}

        {/* === 国試対策 (要件定義書 Phase 2 プレースホルダ) === */}
        {activeTab === "exam" && !selectedClass && (
          <div className="bg-white rounded-2xl border border-orange-50 shadow-sm p-8 text-center animate-fade-in">
            <BookOpen className="mx-auto text-orange-200 mb-3" size={40} />
            <p className="font-bold text-gray-800 mb-2">国試対策(Phase 2機能)</p>
            <p className="text-sm text-gray-500">
              CBT/国試対策の一問一答や過去問データを準備中です。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================
// 共通: タブピルボタン
// =============================================================
function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
        active
          ? "bg-orange-500 text-white shadow-md"
          : "bg-white text-gray-600 border border-gray-200 hover:bg-orange-50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
