"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar, Clock, ChevronRight, ChevronLeft, Menu, BookOpen, Loader2,
  X, Save, Edit2, MapPin, ClipboardList, ExternalLink, Video, Check,
  Search, ArrowLeft, Tag, Share2, Plus, MoreVertical
} from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";

// =============================================================
// DBデータ型定義
// =============================================================
type ClassData = {
  id: string;
  title: string;
  category: string;
  day: string;
  date: string;
  period: string;
  room: string;
  professor: string;
  timeStart: string;
  timeEnd: string;
  timeDisplay: string;
  style: { border: string, bg: string, text: string };
};

type TaskData = {
  id: string;
  classId: string;
  title: string;
  deadline: string;
  completed: boolean;
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

// UIカラースキーマ
const CATEGORY_STYLES: Record<string, { border: string; bg: string; text: string }> = {
  形態系: { border: "border-orange-200", bg: "bg-orange-50", text: "text-orange-700" },
  機能系: { border: "border-blue-400", bg: "bg-blue-50", text: "text-blue-700" },
  生化学: { border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-700" },
  病理: { border: "border-orange-200", bg: "bg-orange-50", text: "text-orange-700" },
  臨床: { border: "border-teal-200", bg: "bg-teal-50", text: "text-teal-700" },
  default: { border: "border-gray-200", bg: "bg-gray-50", text: "text-gray-700" },
};

function autoDetectCategory(subject: string): string {
  if (!subject) return "default";
  if (subject.includes("病理") || subject.includes("解剖")) return "形態系";
  if (subject.includes("薬理") || subject.includes("生理")) return "機能系";
  if (subject.includes("生化学")) return "生化学";
  if (subject.includes("臨床") || subject.includes("PBL") || subject.includes("内科学") || subject.includes("外科学")) return "臨床";
  return "default";
}

const DAYS = ["月", "火", "水", "木", "金"];
const ROW_PERIODS = ["1", "2", "3", "4", "5", "6", "special"];

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

// 簡易バナーコンポーネント
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
  
  // 画面状態
  const [view, setView] = useState<"main" | "classDetail" | "articleDetail">("main");
  const [activeTab, setActiveTab] = useState<"timetable" | "syllabus" | "articles">("timetable");
  
  // DBデータ状態 (モックは一切使用しません)
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [articles, setArticles] = useState<ArticleData[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  
  // 選択状態
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<ArticleData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("すべて");

  // 日付管理
  const [currentDate, setCurrentDate] = useState(new Date("2026-04-13T00:00:00"));
  const weekDates = useMemo(() => getWeekDates(new Date(currentDate)), [currentDate]);

  // DBから全てのデータを取得
  const fetchAllData = async () => {
    setLoading(true);
    try {
      // 1. 時間割の取得
      let rawClasses: any[] = [];
      try {
        const classRes = await supabaseRestFetch<any>({ path: "timetable_classes?select=*" });
        rawClasses = Array.isArray(classRes) ? classRes : (classRes?.data || []);
      } catch (e) { console.error("時間割エラー:", e); }

      // 2. 課題の取得
      let rawTasks: any[] = [];
      try {
        const taskRes = await supabaseRestFetch<any>({ path: "class_tasks?select=*" });
        rawTasks = Array.isArray(taskRes) ? taskRes : (taskRes?.data || []);
      } catch (e) { console.error("課題エラー:", e); }

      // 3. 記事の取得
      let rawArticles: any[] = [];
      try {
        const artRes = await supabaseRestFetch<any>({ path: "articles?select=*" });
        rawArticles = Array.isArray(artRes) ? artRes : (artRes?.data || []);
      } catch (e) { console.error("記事エラー:", e); }

      // 4. キャンペーン（バナー）の取得
      let rawCampaigns: any[] = [];
      try {
        const campRes = await supabaseRestFetch<any>({ path: "campaigns?select=*" });
        rawCampaigns = Array.isArray(campRes) ? campRes : (campRes?.data || []);
      } catch (e) { console.error("キャンペーンエラー:", e); }

      // 状態へのマッピング
      if (rawClasses.length > 0) {
        setClasses(rawClasses.map((c) => {
          const startTime = c.time_start ? c.time_start.substring(0, 5) : "";
          const endTime = c.time_end ? c.time_end.substring(0, 5) : "";
          const cat = autoDetectCategory(c.subject || "");
          return {
            id: String(c.id),
            title: c.subject || "（科目名なし）",
            category: cat,
            day: c.day_of_week || "",
            date: c.date ? c.date.split("T")[0] : "",
            period: String(c.period || ""),
            room: c.room || "",
            professor: c.teacher || "",
            timeStart: startTime,
            timeEnd: endTime,
            timeDisplay: startTime && endTime ? `${startTime} - ${endTime}` : startTime || endTime || "時間未設定",
            style: CATEGORY_STYLES[cat] || CATEGORY_STYLES.default
          };
        }));
      }

      setTasks(rawTasks.map(t => ({
        id: String(t.id),
        classId: String(t.class_id),
        title: t.title || "無題の課題",
        deadline: t.deadline || "期限なし",
        completed: !!t.completed
      })));

      setArticles(rawArticles.map(a => ({
        id: String(a.id),
        title: a.title || "タイトルなし",
        category: a.category || "一般",
        date: a.date || a.created_at?.split("T")[0] || "",
        image: a.image_url || a.image || "https://images.unsplash.com/photo-1576091160550-2173ff9e5ee5?auto=format&fit=crop&q=80&w=600",
        excerpt: a.excerpt || a.description || "",
        content: a.content || a.body || "本文がありません。"
      })));

      setCampaigns(rawCampaigns.map(c => ({
        id: String(c.id),
        title: c.title || "",
        imageUrl: c.image_url || c.image || "",
        sponsorName: c.sponsor_name || c.sponsor || ""
      })));

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // 記事のフィルタリング処理
  const categories = ["すべて", ...Array.from(new Set(articles.map(a => a.category)))];
  const filteredArticles = useMemo(() => {
    return articles.filter(article => {
      const matchQuery = article.title.toLowerCase().includes(searchQuery.toLowerCase()) || article.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = selectedCategory === "すべて" || article.category === selectedCategory;
      return matchQuery && matchCategory;
    });
  }, [searchQuery, selectedCategory, articles]);


  // ============================================================
  // 1. 授業詳細ビュー
  // ============================================================
  if (view === "classDetail" && selectedClass) {
    const classTasks = tasks.filter(t => t.classId === selectedClass.id);

    return (
      <div className="w-full max-w-lg mx-auto bg-white min-h-screen pb-20 animate-in fade-in slide-in-from-right-2 duration-300">
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
          <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 text-xs rounded-full font-bold mb-3 border border-blue-100">
            {selectedClass.category === "default" ? "一般講義" : selectedClass.category}
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{selectedClass.title}</h1>
          <p className="text-sm text-gray-700 mb-6 font-medium">
            {selectedClass.day}・{selectedClass.period === "special" ? "特別枠" : `${selectedClass.period}限`} {selectedClass.timeDisplay} {selectedClass.room} {selectedClass.professor}
          </p>
          
          <div className="flex justify-between border-b border-gray-200 mb-6">
            <button className="pb-3 border-b-2 border-orange-400 text-orange-500 font-bold text-sm px-4">基本情報</button>
            <button className="pb-3 text-gray-500 font-bold text-sm px-4 hover:text-gray-700">課題</button>
            <button className="pb-3 text-gray-500 font-bold text-sm px-4 hover:text-gray-700">メモ・通知</button>
          </div>

          <h3 className="font-bold text-sm text-gray-800 mb-3">授業情報</h3>
          <div className="bg-gray-50 rounded-2xl p-4 mb-4">
            <div className="flex py-2 border-b border-gray-200">
              <div className="w-24 text-xs text-gray-600 flex items-center gap-2"><Clock size={14}/> 時間</div>
              <div className="text-xs font-medium text-gray-800">{selectedClass.timeDisplay}</div>
            </div>
            <div className="flex py-3 border-b border-gray-200">
              <div className="w-24 text-xs text-gray-600 flex items-center gap-2"><Calendar size={14}/> 日付</div>
              <div className="text-xs font-medium text-gray-800">{selectedClass.date.replace(/-/g, '/')}</div>
            </div>
            <div className="flex py-3 border-b border-gray-200">
              <div className="w-24 text-xs text-gray-600 flex items-center gap-2"><MapPin size={14}/> 教室</div>
              <div className="text-xs font-medium text-gray-800">{selectedClass.room || "未設定"}</div>
            </div>
            <div className="flex py-3 items-center">
              <div className="w-24 text-xs text-gray-600 flex items-center gap-2"><Video size={14}/> Zoom URL</div>
              <div className="text-xs font-medium text-blue-500">（登録なし）</div>
            </div>
          </div>

          {/* 課題リスト (DBから取得) */}
          <h3 className="font-bold text-sm text-gray-800 mb-3 mt-8">課題</h3>
          <div className="bg-gray-50 rounded-2xl p-4 mb-8 space-y-4">
            {classTasks.length === 0 ? (
              <p className="text-sm text-gray-500 font-medium">登録されている課題はありません。</p>
            ) : (
              classTasks.map((task) => (
                <div key={task.id} className={`flex gap-3 pb-4 border-b border-gray-200 ${task.completed ? 'opacity-50' : ''}`}>
                  <div className={`rounded w-5 h-5 flex items-center justify-center shrink-0 mt-0.5 ${task.completed ? 'bg-orange-500 text-white' : 'border-2 border-amber-500 bg-amber-50'}`}>
                    {task.completed && <Check size={14} strokeWidth={3} />}
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${task.completed ? 'text-gray-800 line-through decoration-gray-500' : 'text-gray-800'}`}>{task.title}</p>
                    <p className={`text-xs mt-1 font-bold ${task.completed ? 'text-gray-500' : 'text-amber-600'}`}>期限：{task.deadline}</p>
                  </div>
                </div>
              ))
            )}
            <button className="flex items-center gap-2 text-orange-500 text-sm font-bold py-1 hover:text-orange-600">
              <Plus size={16}/> 課題を追加
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // 2. 記事詳細ビュー
  // ============================================================
  if (view === "articleDetail" && selectedArticle) {
    return (
      <div className="min-h-screen bg-white pb-20 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                <Calendar size={12} />{selectedArticle.date.replace(/-/g, '/')}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 leading-tight">{selectedArticle.title}</h1>
          </div>

          <div className="px-4 py-6 prose prose-sm max-w-none">
            {selectedArticle.content.split('\n\n').map((paragraph, idx) => {
              if (paragraph.startsWith('## ')) {
                return <h2 key={idx} className="text-lg font-bold text-gray-800 mt-6 mb-3">{paragraph.replace('## ', '')}</h2>;
              }
              return <p key={idx} className="text-sm text-gray-700 leading-relaxed mb-4">{paragraph}</p>;
            })}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // 3. メインビュー
  // ============================================================
  return (
    <div className="w-full max-w-lg mx-auto pb-8 bg-white min-h-screen animate-in fade-in duration-300">
      
      {/* 共通ヘッダー */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">学校</h2>
          <div className="flex gap-2">
            <button className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"><Plus size={16}/></button>
            <button className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"><Menu size={16}/></button>
          </div>
        </div>

        {/* タブ */}
        <div className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          <button onClick={() => setActiveTab("timetable")} className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "timetable" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-orange-50"}`}>📅 時間割</button>
          <button onClick={() => setActiveTab("syllabus")} className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "syllabus" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-orange-50"}`}>📋 シラバス</button>
          <button onClick={() => setActiveTab("articles")} className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "articles" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-orange-50"}`}>📚 勉強系記事</button>
        </div>
      </div>

      {/* バナー (DBにあれば表示) */}
      {campaigns.length > 0 && (
        <FloatingBanner 
          title={campaigns[0].title}
          imageUrl={campaigns[0].imageUrl}
          sponsorName={campaigns[0].sponsorName} 
        />
      )}

      <div className="px-3 pt-1">
        
        {/* ================= 時間割タブ ================= */}
        {activeTab === "timetable" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2 mb-2">
              <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)))} className="p-1"><ChevronLeft size={20} className="text-gray-400 hover:text-gray-700" /></button>
              <span className="font-bold text-gray-800 text-sm">
                {currentDate.getFullYear()}年{currentDate.getMonth() + 1}月 第{Math.ceil((currentDate.getDate() + (new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() || 7) - 1) / 7)}週
              </span>
              <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)))} className="p-1"><ChevronRight size={20} className="text-gray-400 hover:text-gray-700" /></button>
            </div>

            <div className="bg-white">
              {/* 日付ヘッダー */}
              <div className="grid grid-cols-[24px_1fr_1fr_1fr_1fr_1fr] gap-1 mb-2">
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

              {/* グリッド本体 */}
              {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={30} /></div>
              ) : (
                ROW_PERIODS.map((period) => (
                  <div key={period} className="grid grid-cols-[24px_1fr_1fr_1fr_1fr_1fr] gap-1 mb-1">
                    <div className="flex flex-col items-center justify-center text-[10px] text-gray-400">
                      <span className="font-bold text-gray-500">{period === "special" ? "特" : period}</span>
                      <span className="scale-75">限</span>
                    </div>
                    {weekDates.map((date, i) => {
                      const targetDateStr = formatYYYYMMDD(date);
                      // DBから取得した該当授業を探す
                      const cell = classes.find(c => c.date === targetDateStr && c.period === period);
                      
                      if (!cell) {
                        return <div key={i} className="border border-gray-100 rounded-md bg-gray-50/30 min-h-[70px]"></div>;
                      }

                      // この授業に未完了の課題があるかチェック
                      const hasUncompletedTask = tasks.some(t => t.classId === cell.id && !t.completed);

                      return (
                        <div 
                          key={i} 
                          onClick={() => { setSelectedClass(cell); setView("classDetail"); }}
                          className={`relative border rounded-md p-1.5 min-h-[70px] flex flex-col cursor-pointer hover:opacity-80 transition-opacity ${cell.style.bg} ${cell.style.border} ${cell.style.text}`}
                        >
                          <span className="font-bold text-[10px] leading-tight whitespace-pre-line tracking-tight">{cell.title}</span>
                          {cell.room && <span className="text-[8px] mt-1 opacity-70 leading-tight block">{cell.room}</span>}
                          
                          {/* 課題がある場合はドットを表示 */}
                          {hasUncompletedTask && (
                            <div className="absolute bottom-1.5 left-1.5 flex gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* 凡例 */}
            <div className="flex flex-wrap gap-x-3 gap-y-2 text-[9px] mt-6 px-2 justify-center text-gray-600">
              <span className="flex items-center gap-1"><span className="w-2 h-2 border border-orange-200 bg-orange-50"></span>形態系 / 病理</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 border border-blue-400 bg-blue-50"></span>機能系</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 border border-emerald-200 bg-emerald-50"></span>生化学</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 border border-teal-200 bg-teal-50"></span>臨床</span>
              <span className="flex items-center gap-1 ml-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>課題あり</span>
            </div>
          </div>
        )}

{/* ================= シラバスタブ ================= */}
        {activeTab === "syllabus" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-white p-8 sm:p-12 rounded-2xl border border-gray-100 shadow-sm text-center">
              <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-5">
                <ClipboardList size={36} strokeWidth={2} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">公式シラバスシステム</h3>
              <p className="text-sm text-gray-500 mb-8 leading-relaxed font-medium">
                大学のセキュリティ設定により、アプリ内での直接表示が制限されています。<br className="hidden sm:block" />
                以下のボタンから、安全なブラウザの別タブでシラバスを開いてください。
              </p>
              <a
                href="https://lcu.hama-med.ac.jp/lcu-web/SC_06001B00_21"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#4e72ba] text-white rounded-xl font-bold shadow-sm hover:bg-blue-700 transition-colors w-full sm:w-auto text-sm"
              >
                シラバスシステムを開く <ExternalLink size={18} />
              </a>
            </div>
          </div>
        )}
        {/* ================= 勉強系記事タブ ================= */}
        {activeTab === "articles" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="relative px-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="記事を検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 sm:text-sm transition-colors"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto px-1 pb-1 [&::-webkit-scrollbar]:hidden">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                    selectedCategory === category
                      ? "bg-gray-800 border-gray-800 text-white"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="space-y-3 pb-6">
              {loading ? (
                 <div className="flex justify-center py-10"><Loader2 className="animate-spin text-orange-500" size={30} /></div>
              ) : filteredArticles.length > 0 ? (
                filteredArticles.map((article) => (
                  <div 
                    key={article.id} 
                    onClick={() => { setSelectedArticle(article); setView("articleDetail"); }}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <img src={article.image} alt={article.title} className="w-28 h-28 object-cover shrink-0" />
                    <div className="p-3 flex flex-col justify-center min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-orange-500 font-bold px-1.5 py-0.5 bg-orange-50 rounded-sm">
                          {article.category}
                        </span>
                        <span className="text-[10px] text-gray-400">{article.date.replace(/-/g, '/')}</span>
                      </div>
                      <h4 className="text-sm font-bold text-gray-800 line-clamp-2 mb-1 leading-tight">{article.title}</h4>
                      <p className="text-xs text-gray-500 line-clamp-2 leading-tight">{article.excerpt}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <p className="text-gray-500 text-sm font-bold">記事が登録されていません</p>
                  {searchQuery !== "" && (
                    <button onClick={() => { setSearchQuery(""); setSelectedCategory("すべて"); }} className="mt-2 text-orange-500 text-xs font-bold underline">
                      検索条件をクリア
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}