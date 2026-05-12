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
// 型定義
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
  date?: string; // Supabaseの date (YYYY-MM-DD)
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
// 定数・設定
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

const DAYS = ["日", "月", "火", "水", "木", "金", "土"];
const PERIODS = [1, 2, 3, 4, 5, 6]; //
// 時限に対応する時間を返すヘルパー関数 (UI合わせ)
function getPeriodTime(period: number) {
  const times: Record<number, string> = {
    1: "08:50~10:20",
    2: "10:30~12:00",
    3: "13:00~14:30",
    4: "14:40~16:10",
    5: "16:20~17:50",
    6: "18:00~19:30",
  };
  return times[period] || "";
}

// 選択された日付の「月〜金」の配列を取得
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

// =============================================================
// メインコンポーネント
// =============================================================
export default function SchoolPage() {
  const [activeTab, setActiveTab] = useState<"timetable" | "syllabus" | "articles" | "hospitals" | "exam">("timetable");
  const [loading, setLoading] = useState(true);

  // ユーザーの所属情報 (汎用化のため初期値は空)
  const [userProfile] = useState({
    university: "",
    grade: null as number | null,
  });

  const [classes, setClasses] = useState<ClassData[]>([]);

  // 初期表示を平日に補正
  const initDate = new Date();
  if (initDate.getDay() === 0) initDate.setDate(initDate.getDate() + 1); // 日曜なら月曜へ
  if (initDate.getDay() === 6) initDate.setDate(initDate.getDate() + 2); // 土曜なら月曜へ
  const [currentDate, setCurrentDate] = useState(initDate);
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  
  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);

  // 記事用状態
  const [articles, setArticles] = useState<any[]>([]);
  const [articleSearch, setArticleSearch] = useState("");
  const [articleCategory, setArticleCategory] = useState("すべて");
  const [articlesLoading, setArticlesLoading] = useState(false);

  // 時間割データ取得 (Supabase CSVデータ連動)
  useEffect(() => {
    let cancelled = false;
    async function fetchClasses() {
      setLoading(true);
      try {
        let queryPath = `timetable_classes?select=*,tasks:class_tasks(*)`;
        if (userProfile.university) {
          queryPath += `&university=eq.${encodeURIComponent(userProfile.university)}`;
        }
        if (userProfile.grade) {
          queryPath += `&grade=eq.${userProfile.grade}`;
        }

        const res = await supabaseRestFetch<any[]>({ path: queryPath });
        if (!cancelled && Array.isArray(res)) {
          setClasses(
            res.map((c) => ({
              id: c.id,
              title: c.title || c.subject || "不明な授業",
              // 科目名からカテゴリを推測する簡易ロジック（UI用の色分けのため）
              category: c.category || (c.subject?.includes("小児") || c.subject?.includes("内科") || c.subject?.includes("外科") ? "臨床" : "default"),
              day: c.day || c.day_of_week || "",
              date: c.date ? c.date.split("T")[0] : "", // YYYY-MM-DD を抽出
              periods: Array.isArray(c.periods) ? c.periods : c.period ? [c.period] : [1],
              room: c.room || "",
              professor: c.professor || c.teacher || "",
              timeDisplay: c.time_display,
              term: c.term || "前期",
              zoomUrl: c.zoom_url,
              hasZoom: !!c.zoom_url,
              hasNotice: c.has_notice,
              hasTask: c.tasks && c.tasks.length > 0,
              tasks: c.tasks || [],
            })),
          );
        }
      } catch (error) {
        console.error("時間割取得エラー:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchClasses();
    return () => { cancelled = true; };
  }, [userProfile]);

  // 記事データ取得
  useEffect(() => {
    if (activeTab !== "articles") return;
    let cancelled = false;
    async function fetchArticles() {
      setArticlesLoading(true);
      try {
        const data = await supabaseRestFetch<any[]>({ path: "articles?type=eq.school&select=*" });
        if (!cancelled) setArticles(data || []);
      } catch {
        if (!cancelled) setArticles([]);
      } finally {
        if (!cancelled) setArticlesLoading(false);
      }
    }
    fetchArticles();
    return () => { cancelled = true; };
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

  // 日付の操作
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
  const handleToday = () => {
    setCurrentDate(new Date());
  };
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      const [y, m, d] = e.target.value.split("-");
      setCurrentDate(new Date(Number(y), Number(m) - 1, Number(d)));
    }
  };

  // ============================================================
  // 授業詳細ビュー (画像2枚目のUI)
  // ============================================================
  const renderDetailView = () => {
    if (!selectedClass) return null;
    const style = CATEGORY_STYLES[selectedClass.category] || CATEGORY_STYLES.default;

    return (
      <div className="bg-white min-h-[800px] animate-fade-in pb-20">
        {/* 詳細ヘッダー */}
        <div className="flex items-center justify-between px-4 py-4 mb-2 border-b border-gray-100 sticky top-0 bg-white/90 backdrop-blur-md z-30">
          <button
            onClick={() => setSelectedClass(null)}
            className="w-10 h-10 flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft size={28} />
          </button>
          <h2 className="text-base font-bold text-gray-800">授業の詳細</h2>
          <button className="w-10 h-10 flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-50 transition-colors">
            <MoreVertical size={20} />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className={`inline-block px-3 py-1 rounded-sm text-[10px] font-bold border mb-4 ${style.pill}`}>
            {selectedClass.category}
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2 leading-tight">{selectedClass.title}</h1>
          <p className="text-sm font-bold text-gray-500 mb-6">
            {selectedClass.date ? selectedClass.date.replace(/-/g, "/") : selectedClass.day}・{selectedClass.periods.join("〜")}限{" "}
            {getPeriodTime(selectedClass.periods[0])} {selectedClass.room}{" "}
            {selectedClass.professor || ""}
          </p>

          {/* タブ */}
          <div className="flex border-b border-gray-200 mb-6">
            <button className="flex-1 pb-3 text-sm font-bold text-orange-500 border-b-2 border-orange-500 text-center">基本情報</button>
            <button className="flex-1 pb-3 text-sm font-bold text-gray-400 hover:text-gray-600 text-center transition-colors">課題</button>
            <button className="flex-1 pb-3 text-sm font-bold text-gray-400 hover:text-gray-600 text-center transition-colors">メモ・通知</button>
          </div>

          {/* 基本情報エリア */}
          <h3 className="text-sm font-bold text-gray-800 mb-3">授業情報</h3>
          <div className="bg-[#fcfcfc] rounded-2xl p-5 mb-6 space-y-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                <Clock size={16} className="text-orange-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 font-bold mb-0.5">時間</span>
                <span className="text-sm font-bold text-gray-700">{getPeriodTime(selectedClass.periods[0]) || "時間未設定"}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                <MapPin size={16} className="text-blue-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 font-bold mb-0.5">教室</span>
                <span className="text-sm font-bold text-gray-700">{selectedClass.room || "未定"}</span>
              </div>
            </div>
            {selectedClass.zoomUrl && (
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                  <Video size={16} className="text-emerald-500" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] text-gray-400 font-bold mb-0.5">Zoom URL</span>
                  <a href={`https://${selectedClass.zoomUrl}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-blue-500 hover:underline truncate">
                    {selectedClass.zoomUrl}
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* アクションボタン */}
          {selectedClass.zoomUrl && (
            <div className="flex gap-3 mb-10">
              <button className="flex-1 py-3.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors shadow-sm">
                <Video size={18} /> Zoomを開く
              </button>
              <button className="flex-1 py-3.5 bg-white text-gray-600 border border-gray-200 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors shadow-sm">
                <Edit2 size={18} /> URLを編集
              </button>
            </div>
          )}

          {/* 課題エリア */}
          <h3 className="text-sm font-bold text-gray-800 mb-3">課題</h3>
          <div className="bg-[#fcfcfc] rounded-2xl p-5 border border-gray-100 shadow-sm">
            {selectedClass.tasks && selectedClass.tasks.length > 0 ? (
              <div className="space-y-4">
                {selectedClass.tasks.map((task, idx) => (
                  <div key={task.id} className={`flex items-start gap-3 pb-4 ${idx !== selectedClass.tasks!.length - 1 ? "border-b border-gray-100" : ""}`}>
                    <button className="mt-0.5 shrink-0">
                      {task.completed ? <CheckSquare className="text-orange-300" size={20} /> : <Square className="text-orange-500" size={20} />}
                    </button>
                    <div>
                      <h4 className={`text-sm font-bold mb-1 ${task.completed ? "text-gray-400 line-through" : "text-gray-800"}`}>{task.title}</h4>
                      <div className="flex items-center gap-3">
                        <span className={`text-[11px] ${task.completed ? "text-gray-400" : "text-gray-500"}`}>提出期限 : {task.deadline}</span>
                        {task.completed ? (
                          <span className="text-[11px] text-gray-400 font-bold">提出済み</span>
                        ) : task.days_left ? (
                          <span className="text-[11px] text-orange-500 font-bold">（残り{task.days_left}日）</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6 font-bold">現在、登録されている課題はありません</p>
            )}
            <button className="flex items-center gap-2 text-orange-500 font-bold text-sm mt-4 hover:text-orange-600 transition-colors w-full justify-center py-2 bg-orange-50 rounded-xl border border-orange-100">
              <Plus size={16} /> 新規課題を追加
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // 日次タイムラインビュー (画像1枚目のUI)
  // ============================================================
  const renderDailyTimeline = () => {
    const targetDateStr = formatYYYYMMDD(currentDate);
    const dayOfWeekStr = DAYS[currentDate.getDay()];
    
    // 選択された日付に該当する授業を抽出
    const dayClasses = classes.filter((c) => {
      // 日付(YYYY-MM-DD)が設定されていれば完全一致、なければ曜日で一致判定
      return c.date ? c.date === targetDateStr : c.day === dayOfWeekStr;
    });

    return (
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-orange-50 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] animate-fade-in min-h-[600px]">
        {/* 日付ナビゲーション */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
          <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(d); }} className="p-2.5 hover:bg-gray-50 rounded-full transition-colors text-gray-400">
            <ChevronLeft size={24} />
          </button>
          
          <div className="flex flex-col items-center gap-1">
            <div className="relative group flex items-center cursor-pointer">
              {/* 非表示のネイティブDatePicker（全体を覆う） */}
              <input
                type="date"
                value={targetDateStr}
                onChange={handleDateChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full z-10"
              />
              <h3 className="text-xl font-black text-gray-800 tracking-tight flex items-center gap-2">
                {currentDate.getMonth() + 1}月{currentDate.getDate()}日 ({dayOfWeekStr})
              </h3>
            </div>
            <button onClick={handleToday} className="z-20 text-[10px] font-bold px-3 py-1 bg-orange-50 text-orange-600 rounded-full hover:bg-orange-100 transition-colors">
              今日に戻る
            </button>
          </div>

          <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 1); setCurrentDate(d); }} className="p-2.5 hover:bg-gray-50 rounded-full transition-colors text-gray-400">
            <ChevronRight size={24} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-orange-500" size={40} />
          </div>
        ) : (
          <div className="space-y-4">
            {PERIODS.map((period) => {
              const cellClass = dayClasses.find(c => c.periods.includes(period));
              const isContinuation = cellClass && cellClass.periods[0] !== period;

              // 続きのコマはUI上非表示（1コマ目にまとめて表示するため）
              if (isContinuation) return null;

              if (!cellClass) {
                // 空きコマの表示
                return (
                  <div key={period} className="flex gap-4 opacity-50">
                    <div className="w-14 shrink-0 flex flex-col items-center pt-2">
                      <span className="text-xl font-black text-gray-300">{period}</span>
                      <span className="text-[9px] font-bold text-gray-400 whitespace-nowrap mt-1">{getPeriodTime(period)}</span>
                    </div>
                    <div className="flex-1 bg-gray-50 border border-dashed border-gray-200 rounded-2xl min-h-[80px] flex items-center justify-center text-gray-400 text-sm font-bold">
                      空きコマ
                    </div>
                  </div>
                );
              }

              const style = CATEGORY_STYLES[cellClass.category] || CATEGORY_STYLES.default;

              return (
                <div key={period} className="flex gap-4">
                  {/* 左側：時限と時間 */}
                  <div className="w-14 shrink-0 flex flex-col items-center pt-2">
                    <span className="text-xl font-black text-gray-800">{period}</span>
                    <span className="text-[9px] font-bold text-gray-500 whitespace-nowrap mt-1">{getPeriodTime(period)}</span>
                  </div>

                  {/* 右側：授業カード */}
                  <button
                    onClick={() => setSelectedClass(cellClass)}
                    className="flex-1 bg-white border border-gray-100 rounded-2xl p-4 text-left shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] transition-all hover:shadow-md hover:border-orange-100 hover:scale-[1.01] relative overflow-hidden group"
                  >
                    {/* 左端のカラーライン */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${style.bg.replace("bg-", "bg-").replace("50", "400")}`} />
                    
                    <div className="flex justify-between items-start mb-2 pl-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm ${style.pill}`}>
                        {cellClass.category}
                      </span>
                      <div className="flex gap-1.5">
                        {cellClass.hasZoom && <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" />}
                        {cellClass.hasNotice && <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm" />}
                        {cellClass.hasTask && <div className="w-2.5 h-2.5 rounded-full bg-amber-700 shadow-sm" />}
                      </div>
                    </div>
                    
                    <h4 className="font-bold text-gray-800 text-base mb-2 pl-2 leading-tight group-hover:text-orange-600 transition-colors">
                      {cellClass.title}
                    </h4>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-2 text-xs font-bold text-gray-500">
                      {cellClass.professor && (
                        <span className="flex items-center gap-1">
                          <div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center text-[8px]">👨‍🏫</div>
                          {cellClass.professor}
                        </span>
                      )}
                      {cellClass.room && (
                        <span className="flex items-center gap-1 text-gray-400">
                          <MapPin size={12} />
                          {cellClass.room}
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ============================================================
  // メイン画面
  // ============================================================
  return (
    <div className="w-full max-w-4xl mx-auto bg-gray-50/50 min-h-screen font-sans pb-24">
      {/* ヘッダー */}
      {!selectedClass && (
        <div className="px-4 sm:px-6 py-5 border-b border-gray-100 sticky top-0 bg-white/90 backdrop-blur-md z-20">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">学校</h2>
            <div className="flex gap-2">
              <button className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors bg-white">
                <Plus size={18} strokeWidth={2.5} />
              </button>
              <button className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors bg-white">
                <Menu size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            <TabButton active={activeTab === "timetable"} onClick={() => setActiveTab("timetable")} icon={<Calendar size={16} />} label="時間割" />
            <TabButton active={activeTab === "syllabus"} onClick={() => setActiveTab("syllabus")} icon={<ClipboardList size={16} />} label="シラバス" />
            <TabButton active={activeTab === "articles"} onClick={() => setActiveTab("articles")} icon={<BookOpen size={16} />} label="勉強系記事" />
            <TabButton active={activeTab === "hospitals"} onClick={() => setActiveTab("hospitals")} icon={<Building2 size={16} />} label="研修病院" />
            <TabButton active={activeTab === "exam"} onClick={() => setActiveTab("exam")} icon={<BookOpen size={16} />} label="国試対策" />
          </div>
        </div>
      )}

      {/* バナー広告 */}
      {!selectedClass && activeTab !== "syllabus" && (
        <div className="pt-4 px-4 sm:px-6">
          <FloatingBanner campaignId="1" title="2026年度 初期研修説明会 受付中" imageUrl="https://images.unsplash.com/photo-1758691462848-ba1e929da259?auto=format&fit=crop&q=80&w=1080" sponsorName="医療法人伏見会　伏見病院" />
        </div>
      )}

      <div className={`${!selectedClass ? "p-4 sm:p-6 mt-2" : ""}`}>
        {/* === 時間割（日次タイムライン） === */}
        {activeTab === "timetable" && (selectedClass ? renderDetailView() : renderDailyTimeline())}
        
        {/* === シラバス === */}
        {activeTab === "syllabus" && !selectedClass && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 animate-fade-in">
            <div className="w-full h-[70vh] rounded-2xl overflow-hidden border border-gray-100 relative bg-gray-50">
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-0">
                <Calendar className="text-gray-300 mb-2" size={32} />
                <p className="text-sm text-gray-500 font-bold mb-1">シラバスを読み込んでいます...</p>
              </div>
              {siteConfig.syllabusUrl && (
                <iframe src={siteConfig.syllabusUrl} className="relative z-10 w-full h-full border-none bg-white" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
              )}
            </div>
          </div>
        )}

        {/* === 勉強系記事 === */}
        {activeTab === "articles" && !selectedClass && (
          <div className="space-y-4 animate-fade-in bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
             <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input type="text" placeholder="記事を検索..." value={articleSearch} onChange={(e) => setArticleSearch(e.target.value)} className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 sm:text-sm font-bold text-gray-700 transition-colors" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
              {articleCategories.map((category) => (
                <button key={category} onClick={() => setArticleCategory(category)} className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold border transition-colors ${articleCategory === category ? "bg-gray-800 border-gray-800 text-white" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                  {category}
                </button>
              ))}
            </div>
            <div className="space-y-3 pb-2">
              {filteredArticles.map((article) => (
                <Link key={article.id} href={`/school/articles/${article.id}`} className="block bg-white rounded-2xl border border-gray-100 overflow-hidden flex hover:shadow-md transition-shadow">
                  <img src={article.image_url || article.image} alt="" className="w-28 h-28 object-cover shrink-0 bg-gray-50" />
                  <div className="p-3 flex flex-col justify-center min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-gray-800 line-clamp-2">{article.title}</h4>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* === その他プレースホルダ === */}
        {activeTab === "hospitals" && !selectedClass && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center animate-fade-in">
            <Building2 className="mx-auto text-orange-200 mb-3" size={40} />
            <p className="font-bold text-gray-800 mb-2">研修病院紹介(Phase 2機能)</p>
            <p className="text-sm text-gray-500">4年生以上向けに、病院見学マニュアル・病院一覧などを公開予定です。</p>
          </div>
        )}
        {activeTab === "exam" && !selectedClass && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center animate-fade-in">
            <BookOpen className="mx-auto text-orange-200 mb-3" size={40} />
            <p className="font-bold text-gray-800 mb-2">国試対策(Phase 2機能)</p>
            <p className="text-sm text-gray-500">CBT/国試対策の一問一答や過去問データを準備中です。</p>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================
// タブピルボタン
// =============================================================
function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; }) {
  return (
    <button onClick={onClick} className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${active ? "bg-orange-500 text-white shadow-md shadow-orange-500/20" : "bg-white text-gray-600 border border-gray-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200"}`}>
      {icon}
      {label}
    </button>
  );
}