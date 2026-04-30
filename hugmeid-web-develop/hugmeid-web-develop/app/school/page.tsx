"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { 
  Calendar, Clock, ChevronRight, ChevronLeft, Menu, Search, BookOpen, 
  Plus, Loader2, MapPin, UserRound, MoreVertical, Video, Edit2, Check 
} from "lucide-react";
import { schoolArticles } from "@/lib/data";
import { siteConfig } from "@/lib/site";
import type { TimetableClassDto, TimetableDay, TimetableGridDto, TimetableResponse } from "@/lib/timetable-dto";

const CATEGORIES = ["すべて", ...Array.from(new Set(schoolArticles.map((a) => a.category)))];
const DAY_ACCENTS: Record<TimetableDay, string> = {
  月: "border-sky-100 bg-sky-50 text-sky-900",
  火: "border-rose-100 bg-rose-50 text-rose-900",
  水: "border-emerald-100 bg-emerald-50 text-emerald-900",
  木: "border-amber-100 bg-amber-50 text-amber-900",
  金: "border-violet-100 bg-violet-50 text-violet-900",
  土: "border-gray-100 bg-gray-50 text-gray-900",
  日: "border-gray-100 bg-gray-50 text-gray-900",
};

function formatClassTime(item: TimetableClassDto) {
  if (!item.startsAt || !item.endsAt) return `${item.period}限`;
  return `${item.period}限 ${item.startsAt}-${item.endsAt}`;
}

export default function SchoolPage() {
  const [activeTab, setActiveTab] = useState<"timetable" | "syllabus" | "articles">("timetable");
  const [view, setView] = useState<"main" | "detail">("main");
  const [selectedClass, setSelectedClass] = useState<TimetableClassDto | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("すべて");
  const [days, setDays] = useState<TimetableDay[]>(["月", "火", "水", "木", "金"]);
  const [periods, setPeriods] = useState([1, 2, 3, 4, 5, 6]);
  const [timetableGrid, setTimetableGrid] = useState<TimetableGridDto>({ 月: {}, 火: {}, 水: {}, 木: {}, 金: {}, 土: {}, 日: {} });
  const [classes, setClasses] = useState<TimetableClassDto[]>([]);
  const [loadingTimetable, setLoadingTimetable] = useState(true);
  const [timetableError, setTimetableError] = useState<string | null>(null);

  // 詳細画面内のタブ状態（UIモック用）
  const [detailTab, setDetailTab] = useState<"info" | "tasks" | "memo">("info");

  useEffect(() => {
    let cancelled = false;

    async function loadTimetable() {
      setLoadingTimetable(true);
      setTimetableError(null);
      try {
        const response = await fetch("/api/timetable", { cache: "no-store" });
        const data = (await response.json()) as TimetableResponse | { ok: false; error?: { message?: string } };
        if (!response.ok || !data.ok) {
          throw new Error(data.ok ? "時間割の取得に失敗しました" : data.error?.message ?? "時間割の取得に失敗しました");
        }
        if (!cancelled) {
          setDays(data.days);
          setPeriods(data.periods);
          setClasses(data.items);
          setTimetableGrid(data.grid);
        }
      } catch (error) {
        if (!cancelled) setTimetableError(error instanceof Error ? error.message : "時間割の取得に失敗しました");
      } finally {
        if (!cancelled) setLoadingTimetable(false);
      }
    }

    void loadTimetable();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredArticles = useMemo(() => {
    return schoolArticles.filter((article) => {
      const query = searchQuery.trim().toLowerCase();
      const matchQuery = !query || `${article.title} ${article.excerpt || ""}`.toLowerCase().includes(query);
      const matchCategory = selectedCategory === "すべて" || article.category === selectedCategory;
      return matchQuery && matchCategory;
    });
  }, [searchQuery, selectedCategory]);

  const syllabusClasses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return classes;
    return classes.filter((item) => [item.title, item.instructor, item.room, item.location].filter(Boolean).join(" ").toLowerCase().includes(query));
  }, [classes, searchQuery]);

  const hasTimetable = classes.length > 0;

  // ===== 授業詳細ビュー =====
  if (view === "detail" && selectedClass) {
    return (
      <div className="w-full max-w-lg mx-auto bg-white min-h-screen pb-20 animate-fade-in">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <button onClick={() => setView("main")} className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 hover:bg-gray-50 transition-colors">
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <h2 className="text-lg font-bold text-gray-800">授業の詳細</h2>
          <button className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 hover:bg-gray-50 transition-colors">
            <MoreVertical size={20} className="text-gray-600" />
          </button>
        </div>

        <div className="px-5 pt-4">
          {/* 授業タイトルと基本情報 */}
          <span className={`inline-block px-3 py-1 text-[10px] rounded-full font-bold mb-3 border ${DAY_ACCENTS[selectedClass.day]}`}>
            {selectedClass.sourceType === "official_pdf" ? "公式シラバス" : "追加機能"}
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mb-3 leading-snug">{selectedClass.title}</h1>
          <p className="text-sm text-gray-700 mb-6 font-medium flex flex-wrap gap-x-3 gap-y-1 items-center">
            <span>{selectedClass.day}曜・{formatClassTime(selectedClass)}</span>
            <span>{selectedClass.room || selectedClass.location || "教室未定"}</span>
            <span>{selectedClass.instructor ? `${selectedClass.instructor} 教授` : "担当未定"}</span>
          </p>
          
          {/* タブナビゲーション */}
          <div className="flex justify-between border-b border-gray-200 mb-6">
            <button 
              onClick={() => setDetailTab("info")}
              className={`pb-3 font-bold text-sm px-4 transition-colors ${detailTab === "info" ? "border-b-2 border-pink-400 text-pink-500" : "text-gray-400 hover:text-gray-600"}`}
            >
              基本情報
            </button>
            <button 
              onClick={() => setDetailTab("tasks")}
              className={`pb-3 font-bold text-sm px-4 transition-colors ${detailTab === "tasks" ? "border-b-2 border-pink-400 text-pink-500" : "text-gray-400 hover:text-gray-600"}`}
            >
              課題
            </button>
            <button 
              onClick={() => setDetailTab("memo")}
              className={`pb-3 font-bold text-sm px-4 transition-colors ${detailTab === "memo" ? "border-b-2 border-pink-400 text-pink-500" : "text-gray-400 hover:text-gray-600"}`}
            >
              メモ・通知
            </button>
          </div>

          {/* 基本情報タブ */}
          {detailTab === "info" && (
            <div className="animate-fade-in">
              <h3 className="font-bold text-sm text-gray-800 mb-3">授業情報</h3>
              <div className="bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-100">
                <div className="flex py-2 border-b border-gray-200">
                  <div className="w-24 text-xs text-gray-500 flex items-center gap-2"><Clock size={14}/> 時間</div>
                  <div className="text-xs font-medium text-gray-800">{formatClassTime(selectedClass)}</div>
                </div>
                <div className="flex py-3 border-b border-gray-200">
                  <div className="w-24 text-xs text-gray-500 flex items-center gap-2"><Calendar size={14}/> 開講期間</div>
                  <div className="text-xs font-medium text-gray-800">
                    {selectedClass.academicYear ? `${selectedClass.academicYear}年度` : "年度未設定"} {selectedClass.termNumber ? `第${selectedClass.termNumber}ターム` : ""}
                  </div>
                </div>
                <div className="flex py-3 border-b border-gray-200">
                  <div className="w-24 text-xs text-gray-500 flex items-center gap-2"><MapPin size={14}/> 教室</div>
                  <div className="text-xs font-medium text-gray-800">{selectedClass.room || selectedClass.location || "未設定"}</div>
                </div>
                <div className="flex py-3 items-center">
                  <div className="w-24 text-xs text-gray-500 flex items-center gap-2"><Video size={14}/> Zoom URL</div>
                  <div className="text-xs font-medium text-blue-500 cursor-pointer hover:underline truncate">zoom.us/j/12345678...</div>
                </div>
              </div>
              
              <div className="flex gap-3 mb-8">
                <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-600 text-sm font-bold hover:bg-blue-100 transition-colors shadow-sm active:scale-95">
                  <Video size={16}/> Zoomを開く
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 text-gray-700 text-sm font-bold hover:bg-gray-50 transition-colors shadow-sm active:scale-95">
                  <Edit2 size={16}/> URLを編集
                </button>
              </div>
            </div>
          )}

          {/* 課題タブ (モックデータ) */}
          {detailTab === "tasks" && (
            <div className="animate-fade-in">
              <h3 className="font-bold text-sm text-gray-800 mb-3">課題</h3>
              <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-8 space-y-4 shadow-sm">
                <div className="flex gap-3 pb-4 border-b border-gray-100 opacity-50">
                  <div className="bg-pink-500 text-white rounded w-5 h-5 flex items-center justify-center shrink-0 mt-0.5"><Check size={14} strokeWidth={3}/></div>
                  <div>
                    <p className="text-sm font-bold text-gray-800 line-through decoration-gray-500">第1回レポート（心臓生理）</p>
                    <p className="text-xs text-gray-500 mt-1">提出期限：4月3日　提出済み</p>
                  </div>
                </div>
                <div className="flex gap-3 pb-4 border-b border-gray-100">
                  <div className="border-2 border-amber-500 bg-amber-50 rounded w-5 h-5 shrink-0 mt-0.5 cursor-pointer hover:bg-amber-100 transition-colors"></div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">第2回レポート（呼吸生理）</p>
                    <p className="text-xs text-amber-600 font-bold mt-1">提出期限：4月10日（残り3日）</p>
                  </div>
                </div>
                <div className="flex gap-3 pb-4 border-b border-gray-100">
                  <div className="border-2 border-gray-300 bg-white rounded w-5 h-5 shrink-0 mt-0.5 cursor-pointer hover:bg-gray-50 transition-colors"></div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">中間テスト範囲まとめ</p>
                    <p className="text-xs text-gray-500 mt-1">提出期限：4月25日</p>
                  </div>
                </div>
                <button className="flex items-center gap-2 text-pink-500 text-sm font-bold py-1 hover:text-pink-600 transition-colors">
                  <Plus size={16}/> 課題を追加
                </button>
              </div>
            </div>
          )}

          {/* メモ・通知タブ (モックデータ) */}
          {detailTab === "memo" && (
            <div className="animate-fade-in">
              <h3 className="font-bold text-sm text-gray-800 mb-3">メモ</h3>
              <div className="bg-amber-50/50 rounded-xl p-4 mb-3 border border-amber-100 text-sm text-gray-800 leading-relaxed shadow-sm relative group cursor-pointer">
                第3回は心臓の電気生理がメイン。試験範囲はp.45-78。<br/>教科書持参必須。
                <div className="absolute top-2 right-2 p-1.5 bg-white/80 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                  <Edit2 size={14} className="text-gray-500" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-8">
                <span className="px-3 py-1 rounded-full border border-pink-200 bg-pink-50 text-pink-600 text-xs font-bold shadow-sm">試験あり</span>
                <span className="px-3 py-1 rounded-full border border-purple-200 bg-purple-50 text-purple-600 text-xs font-bold shadow-sm">必修</span>
                <button className="px-3 py-1 rounded-full border border-gray-200 bg-white text-gray-500 text-xs font-bold hover:bg-gray-50 transition-colors shadow-sm">+ タグ追加</button>
              </div>

              <h3 className="font-bold text-sm text-gray-800 mb-3">LINE通知</h3>
              <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-5 shadow-sm">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-bold text-gray-800">授業リマインド</p>
                    <p className="text-xs text-gray-500 mt-1">30分前に通知</p>
                  </div>
                  <div className="w-12 h-6 bg-pink-400 rounded-full flex items-center p-1 justify-end cursor-pointer transition-colors shadow-inner">
                    <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-bold text-gray-800">課題期限リマインド</p>
                    <p className="text-xs text-gray-500 mt-1">期限2日前に通知</p>
                  </div>
                  <div className="w-12 h-6 bg-pink-400 rounded-full flex items-center p-1 justify-end cursor-pointer transition-colors shadow-inner">
                    <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-bold text-gray-800">休講・教室変更</p>
                    <p className="text-xs text-gray-500 mt-1">即時通知</p>
                  </div>
                  <div className="w-12 h-6 bg-gray-200 rounded-full flex items-center p-1 justify-start cursor-pointer transition-colors shadow-inner">
                    <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== メインビュー (以下変更なし) =====
  return (
    <div className="w-full max-w-lg mx-auto pb-8 bg-white min-h-screen animate-fade-in">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">学校</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Supabase dev 接続中</p>
          </div>
          <div className="flex gap-2">
            <button className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400" title="授業追加は次フェーズで接続"><Plus size={16} /></button>
            <button className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"><Menu size={16} /></button>
            <button className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"><Clock size={16} /></button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          <button onClick={() => setActiveTab("timetable")} className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "timetable" ? "bg-pink-500 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-pink-50"}`}>時間割</button>
          <button onClick={() => setActiveTab("syllabus")} className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "syllabus" ? "bg-pink-500 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-pink-50"}`}>シラバス</button>
          <button onClick={() => setActiveTab("articles")} className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "articles" ? "bg-pink-500 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-pink-50"}`}>勉強系記事</button>
        </div>
      </div>

      <div className="px-3 pt-4">
        {activeTab === "timetable" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2 mb-2">
              <button className="p-1"><ChevronLeft size={20} className="text-gray-300" /></button>
              <div className="text-center">
                <span className="block font-bold text-gray-800">マイ時間割</span>
                <span className="block text-[10px] text-gray-400">devユーザーのログイン後画面想定</span>
              </div>
              <button className="p-1"><ChevronRight size={20} className="text-gray-300" /></button>
            </div>

            {loadingTimetable ? (
              <div className="bg-white rounded-2xl border border-pink-100 p-8 text-center">
                <Loader2 className="mx-auto text-pink-300 mb-3 animate-spin" size={40} />
                <p className="font-bold text-gray-800">時間割を読み込んでいます</p>
              </div>
            ) : timetableError ? (
              <div className="bg-white rounded-2xl border border-red-100 p-8 text-center">
                <Calendar className="mx-auto text-red-200 mb-3" size={40} />
                <p className="font-bold text-gray-800 mb-2">時間割を取得できませんでした</p>
                <p className="text-sm text-gray-500">{timetableError}</p>
              </div>
            ) : hasTimetable ? (
              <div className="bg-white">
                <div className="grid grid-cols-[24px_repeat(5,minmax(0,1fr))] gap-1 mb-2">
                  <div />
                  {days.map((day) => (
                    <div key={day} className="text-center flex flex-col items-center">
                      <span className="text-gray-800 text-xs font-bold h-6 flex items-center justify-center">{day}</span>
                      <span className="text-gray-500 text-[10px] mt-0.5">曜</span>
                    </div>
                  ))}
                </div>

                {periods.map((period) => (
                  <div key={period} className="grid grid-cols-[24px_repeat(5,minmax(0,1fr))] gap-1 mb-1">
                    <div className="flex flex-col items-center justify-center text-[10px] text-gray-400">
                      <span className="font-bold">{period}</span>
                      <span className="scale-75">限</span>
                    </div>
                    {days.map((day) => {
                      const cell = timetableGrid[day]?.[period];
                      if (!cell) {
                        return <div key={`${day}-${period}`} className="border border-gray-200 rounded-md bg-gray-50/30 min-h-[76px]" />;
                      }
                      return (
                        <button
                          key={`${day}-${period}`}
                          onClick={() => {
                            setSelectedClass(cell);
                            setView("detail");
                            setDetailTab("info"); // タブをリセット
                          }}
                          className={`relative border rounded-md p-1.5 min-h-[76px] flex flex-col text-left hover:opacity-80 transition-opacity ${DAY_ACCENTS[day]}`}
                        >
                          <span className="font-bold text-[10px] leading-tight tracking-tight line-clamp-3">{cell.title}</span>
                          {cell.room ? <span className="text-[8px] mt-1 opacity-70 leading-tight line-clamp-1">{cell.room}</span> : null}
                          {cell.instructor ? <span className="text-[8px] mt-auto opacity-60 leading-tight line-clamp-1">{cell.instructor}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-pink-100 p-8 text-center">
                <Calendar className="mx-auto text-pink-200 mb-3" size={40} />
                <p className="font-bold text-gray-800 mb-2">時間割データは未登録です</p>
                <p className="text-sm text-gray-500">dev seedに授業データを追加するとここに表示されます。</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "syllabus" && (
          <div className="space-y-4">
            <div className="relative px-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input type="text" placeholder="授業名・教員・教室で検索" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 sm:text-sm transition-colors" />
            </div>

            {siteConfig.syllabusUrl ? (
              <div className="w-full h-72 rounded-xl overflow-hidden border border-gray-200 shadow-sm relative bg-gray-50">
                <iframe src={siteConfig.syllabusUrl} title="大学シラバス" className="relative z-10 w-full h-full border-none bg-white" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
              </div>
            ) : null}

            {loadingTimetable ? (
              <div className="rounded-2xl border border-pink-100 p-8 text-center"><Loader2 className="mx-auto text-pink-300 mb-3 animate-spin" size={36} /></div>
            ) : syllabusClasses.length === 0 ? (
              <div className="bg-white rounded-2xl border border-pink-100 p-8 text-center">
                <Calendar className="mx-auto text-pink-200 mb-3" size={40} />
                <p className="font-bold text-gray-800 mb-2">授業データは未登録です</p>
                <p className="text-sm text-gray-500">授業seedまたはシラバスURLを設定してください。</p>
              </div>
            ) : (
              <div className="space-y-3">
                {syllabusClasses.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedClass(item);
                      setView("detail");
                      setDetailTab("info");
                    }}
                    className="w-full text-left bg-white rounded-2xl border border-pink-50 p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-gray-800 leading-snug">{item.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{item.instructor || "教員未設定"}</p>
                      </div>
                      <span className="shrink-0 text-[10px] font-bold text-pink-600 bg-pink-50 px-2 py-1 rounded-full">{item.day}{item.period}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-3">{[item.room, item.location].filter(Boolean).join(" / ") || "教室未設定"}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "articles" && (
          <div className="space-y-4 animate-fade-in">
            <div className="relative px-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input type="text" placeholder="記事を検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 sm:text-sm transition-colors" />
            </div>

            <div className="flex gap-2 overflow-x-auto px-1 pb-1 hide-scrollbar">
              {CATEGORIES.map((category) => (
                <button key={category} onClick={() => setSelectedCategory(category)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${selectedCategory === category ? "bg-gray-800 border-gray-800 text-white" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>{category}</button>
              ))}
            </div>

            {filteredArticles.length === 0 ? (
              <div className="bg-white rounded-2xl border border-pink-100 p-8 text-center">
                <BookOpen className="mx-auto text-pink-200 mb-3" size={40} />
                <p className="font-bold text-gray-800 mb-2">勉強系記事はまだありません</p>
                <p className="text-sm text-gray-500">schoolArticles に本番記事を追加すると、ここに表示されます。</p>
              </div>
            ) : (
              filteredArticles.map((article) => (
                <Link key={article.id} href={`/school/articles/${article.id}`} className="block bg-white rounded-2xl shadow-sm border border-pink-50 overflow-hidden hover:shadow-md transition-shadow group">
                  <div className="flex gap-4 p-4">
                    <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                      {article.image ? <img src={article.image} alt={article.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /> : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-50 text-purple-600 rounded">{article.category}</span>
                        <span className="text-[10px] text-gray-400">{article.date}</span>
                      </div>
                      <h3 className="font-bold text-gray-800 leading-tight line-clamp-2 group-hover:text-pink-600 transition-colors">{article.title}</h3>
                      {article.excerpt ? <p className="text-xs text-gray-500 mt-2 line-clamp-2">{article.excerpt}</p> : null}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
