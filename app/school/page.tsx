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
  Loader2,
  Building2,
  ClipboardList,
  Search,
  MoreVertical,
  MapPin,
  Edit2,
  Square,
  CalendarDays,
  X,
  Save
} from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";
import { FloatingBanner } from "@/components/FloatingBanner";
import { siteConfig } from "@/lib/site";

// =============================================================
// 型定義 (アップロードされた CSV カラムに完全準拠)
// =============================================================
type ClassData = {
  id: string;
  title: string;       // CSV: subject
  category: string;    // 表示用カラーカテゴリ
  day: string;         // CSV: day_of_week
  date: string;        // CSV: date
  period: string;      // CSV: period ("1"〜"6" または "special")
  room: string;        // CSV: room
  professor: string;   // CSV: teacher
  timeStart: string;   // CSV: time_start
  timeEnd: string;     // CSV: time_end
  timeDisplay: string; // フロント表示用
};

// =============================================================
// 教科カテゴリの色定義 (授業名から自動判定するロジック付き)
// =============================================================
const CATEGORY_STYLES: Record<
  string,
  { border: string; bg: string; text: string; pill: string }
> = {
  形態系: { border: "border-orange-200", bg: "bg-orange-50", text: "text-orange-700", pill: "bg-orange-50 text-orange-600 border-orange-100" },
  機能系: { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-700", pill: "bg-blue-50 text-blue-600 border-blue-100" },
  生化学: { border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-700", pill: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  病理: { border: "border-rose-200", bg: "bg-rose-50", text: "text-rose-700", pill: "bg-rose-50 text-rose-600 border-rose-100" },
  臨床: { border: "border-teal-200", bg: "bg-teal-50", text: "text-teal-700", pill: "bg-teal-50 text-teal-600 border-teal-100" },
  default: { border: "border-gray-200", bg: "bg-gray-50/50", text: "text-gray-700", pill: "bg-gray-100 text-gray-600 border-gray-200" },
};

function autoDetectCategory(subject: string): string {
  if (subject.includes("病理")) return "病理";
  if (subject.includes("薬理") || subject.includes("生理")) return "機能系";
  if (subject.includes("解剖")) return "形態系";
  if (subject.includes("生化学")) return "生化学";
  if (subject.includes("臨床") || subject.includes("PBL") || subject.includes("内科学") || subject.includes("外科学")) return "臨床";
  return "default";
}

const DAYS = ["月", "火", "水", "木", "金"];
// 1〜6限に加え、CSVに含まれる "special" 枠を行として定義
const ROW_PERIODS = ["1", "2", "3", "4", "5", "6", "special"];

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

function formatYYYYMMDD(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// =============================================================
// 学校ページ メインコンポーネント
// =============================================================
export default function SchoolPage() {
  const [activeTab, setActiveTab] = useState<"timetable" | "syllabus" | "articles">("timetable");
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassData[]>([]);
  
  // 初期表示をCSVデータが存在する2026年4月に設定（テストがすぐ行えるようにしています）
  const [currentDate, setCurrentDate] = useState(new Date("2026-04-13"));
  
  // 詳細表示・編集用のState
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ClassData>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  const weekDates = useMemo(() => getWeekDates(new Date(currentDate)), [currentDate]);

  // 初期データ取得 (DBからそのまま全データをロード)
  useEffect(() => {
    let cancelled = false;
    async function fetchClasses() {
      setLoading(true);
      try {
        const res = await supabaseRestFetch<any[]>({ path: `timetable_classes?select=*` });
        
        if (!cancelled && Array.isArray(res)) {
          setClasses(
            res.map((c) => {
              // 時刻表記の末尾の秒をカット (例: "08:50:00" -> "08:50")
              const startTime = c.time_start ? c.time_start.substring(0, 5) : "";
              const endTime = c.time_end ? c.time_end.substring(0, 5) : "";
              const timeDisplay = startTime && endTime ? `${startTime} - ${endTime}` : startTime || endTime || "時間未設定";

              return {
                id: c.id,
                title: c.subject || "",
                category: autoDetectCategory(c.subject || ""),
                day: c.day_of_week || "",
                date: c.date ? c.date.split("T")[0] : "",
                period: String(c.period || ""),
                room: c.room || "",
                professor: c.teacher || "",
                timeStart: startTime,
                timeEnd: endTime,
                timeDisplay: timeDisplay,
              };
            })
          );
        }
      } catch (error) {
        console.error("時間割取得エラー:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchClasses();
    return () => {
      cancelled = true;
    };
  }, []);

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
  // 詳細ページの保存処理 (CSV/DB カラム名に完全準拠した PATCH)
  // ============================================================
  const handleSaveClass = async () => {
    if (!selectedClass) return;
    setIsSaving(true);
    
    try {
      await supabaseRestFetch<any>({
        path: `timetable_classes?id=eq.${selectedClass.id}`,
        method: "PATCH",
        body: {
          subject: editForm.title,
          room: editForm.room,
          teacher: editForm.professor,
          time_start: editForm.timeStart ? `${editForm.timeStart}:00` : null,
          time_end: editForm.timeEnd ? `${editForm.timeEnd}:00` : null,
          period: editForm.period,
        },
      });

      const updatedClass: ClassData = {
        ...selectedClass,
        title: editForm.title || "",
        room: editForm.room || "",
        professor: editForm.professor || "",
        period: editForm.period || "1",
        timeStart: editForm.timeStart || "",
        timeEnd: editForm.timeEnd || "",
        timeDisplay: editForm.timeStart && editForm.timeEnd ? `${editForm.timeStart} - ${editForm.timeEnd}` : "時間未設定",
        category: autoDetectCategory(editForm.title || ""),
      };

      setClasses((prev) => prev.map((c) => (c.id === updatedClass.id ? updatedClass : c)));
      setSelectedClass(updatedClass);
      setIsEditing(false);
    } catch (error) {
      console.error("更新エラー:", error);
      alert("保存に失敗しました。通信環境や入力形式を確認してください。");
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================================
  // 授業詳細ビュー (閲覧 / 編集モード)
  // ============================================================
  const renderDetailView = () => {
    if (!selectedClass) return null;
    const style = CATEGORY_STYLES[selectedClass.category] || CATEGORY_STYLES.default;

    return (
      <div className="bg-white min-h-[800px] animate-fade-in pb-20">
        <div className="flex items-center justify-between px-4 py-4 mb-2 border-b border-gray-100">
          <button
            onClick={() => {
              if (isEditing) {
                if(confirm("編集を破棄して戻りますか？")) setIsEditing(false);
              } else {
                setSelectedClass(null);
              }
            }}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
          >
            {isEditing ? <X size={24} /> : <ChevronLeft size={24} />}
          </button>
          
          <h2 className="text-base font-bold text-gray-800">
            {isEditing ? "授業の編集" : "授業の詳細"}
          </h2>
          
          {!isEditing ? (
            <button 
              onClick={() => {
                setEditForm({ ...selectedClass });
                setIsEditing(true);
              }}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-orange-200 text-orange-500 hover:bg-orange-50 transition-colors"
            >
              <Edit2 size={18} />
            </button>
          ) : (
            <div className="w-10 h-10"></div>
          )}
        </div>

        <div className="px-6 pt-4">
          {isEditing ? (
            /* ========== 編集モード ========== */
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">授業名 / 科目名 (subject)</label>
                <input
                  type="text"
                  value={editForm.title || ""}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">開始時間 (time_start)</label>
                  <input
                    type="time"
                    value={editForm.timeStart || ""}
                    onChange={(e) => setEditForm({ ...editForm, timeStart: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">終了時間 (time_end)</label>
                  <input
                    type="time"
                    value={editForm.timeEnd || ""}
                    onChange={(e) => setEditForm({ ...editForm, timeEnd: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">教室 (room)</label>
                  <input
                    type="text"
                    value={editForm.room || ""}
                    onChange={(e) => setEditForm({ ...editForm, room: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">時限枠 (period)</label>
                  <select
                    value={editForm.period || "1"}
                    onChange={(e) => setEditForm({ ...editForm, period: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold"
                  >
                    <option value="1">1限</option>
                    <option value="2">2限</option>
                    <option value="3">3限</option>
                    <option value="4">4限</option>
                    <option value="5">5限</option>
                    <option value="6">6限</option>
                    <option value="special">special (特殊枠)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">担当教員 (teacher)</label>
                <input
                  type="text"
                  value={editForm.professor || ""}
                  onChange={(e) => setEditForm({ ...editForm, professor: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold"
                />
              </div>

              <div className="pt-6 flex gap-3">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveClass}
                  disabled={isSaving}
                  className="flex-1 py-3.5 bg-orange-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  {isSaving ? "保存中..." : "保存する"}
                </button>
              </div>
            </div>
          ) : (
            /* ========== 閲覧モード ========== */
            <>
              <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold border mb-4 ${style.pill}`}>
                {selectedClass.category === "default" ? "一般講義" : selectedClass.category}
              </div>

              <h1 className="text-2xl font-bold text-gray-900 mb-3">{selectedClass.title}</h1>
              <p className="text-sm font-bold text-gray-600 mb-8">
                {selectedClass.date.replace(/-/g, "/")} ({selectedClass.day}) ・ {selectedClass.period === "special" ? "特別枠" : `${selectedClass.period}限`}
              </p>

              <h3 className="text-sm font-bold text-gray-800 mb-4">授業情報</h3>
              <div className="bg-gray-50 rounded-2xl p-5 mb-6 space-y-4 border border-gray-100">
                <div className="flex items-center gap-4">
                  <Clock size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-700 font-medium">{selectedClass.timeDisplay}</span>
                </div>
                <div className="flex items-center gap-4">
                  <MapPin size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-700 font-medium">{selectedClass.room || "場所未設定"}</span>
                </div>
                <div className="flex items-center gap-4">
                  <BookOpen size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-700 font-medium">{selectedClass.professor || "教員未設定"}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // ============================================================
  // 時間割グリッド (完全にDBのデータのみに依存する表示)
  // ============================================================
  const renderTimetableGrid = () => {
    const todayStr = formatYYYYMMDD(new Date());

    return (
      <div className="bg-white p-2 sm:p-6 rounded-xl sm:rounded-2xl border border-orange-50 shadow-sm animate-fade-in w-full">
        {/* 上部操作パネル */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <button onClick={handlePrevWeek} className="p-1 sm:p-2 hover:bg-gray-50 rounded-full transition-colors">
            <ChevronLeft size={20} className="text-gray-400 sm:w-6 sm:h-6" />
          </button>
          
          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3">
            <div className="relative group flex items-center cursor-pointer">
              <input
                type="date"
                value={formatYYYYMMDD(currentDate)}
                onChange={handleDateChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full z-10"
              />
              <h3 className="text-sm sm:text-lg font-bold text-gray-800 group-hover:text-orange-500 transition-colors flex items-center gap-1 sm:gap-2">
                {getWeekOfMonthString(currentDate)}
                <CalendarDays size={16} className="text-gray-400 group-hover:text-orange-500 sm:w-[18px] sm:h-[18px]" />
              </h3>
            </div>
            <button onClick={handleToday} className="z-20 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 bg-orange-50 text-orange-600 border border-orange-100 rounded-full hover:bg-orange-100 transition-colors">
              今週
            </button>
          </div>

          <button onClick={handleNextWeek} className="p-1 sm:p-2 hover:bg-gray-50 rounded-full transition-colors">
            <ChevronRight size={20} className="text-gray-400 sm:w-6 sm:h-6" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-orange-500" size={40} />
          </div>
        ) : (
          <div className="w-full">
            {/* 曜日ヘッダー */}
            <div className="grid grid-cols-[18px_repeat(5,1fr)] sm:grid-cols-[28px_repeat(5,1fr)] gap-0.5 sm:gap-2 mb-2">
              <div />
              {weekDates.map((date, i) => {
                const targetDateStr = formatYYYYMMDD(date);
                const isToday = targetDateStr === todayStr;
                return (
                  <div key={i} className="text-center flex flex-col items-center">
                    <span className={`text-[10px] sm:text-base font-bold ${isToday ? "text-orange-500" : "text-gray-800"}`}>
                      {date.getDate()}
                    </span>
                    <div className={`text-[9px] sm:text-xs font-bold w-4 h-4 sm:w-7 sm:h-7 rounded-full flex items-center justify-center mt-0.5 ${isToday ? "bg-orange-500 text-white shadow-sm" : "text-gray-500"}`}>
                      {DAYS[i]}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* コマ行ループ (1〜6限 + special) */}
            {ROW_PERIODS.map((period) => (
              <div key={period} className="grid grid-cols-[18px_repeat(5,1fr)] sm:grid-cols-[28px_repeat(5,1fr)] gap-0.5 sm:gap-2 mb-0.5 sm:mb-2">
                
                {/* 時限サイドインジケータ */}
                <div className="flex flex-col items-center justify-center text-gray-400 h-full">
                  <span className={`font-bold leading-none ${period === "special" ? "text-[8px] sm:text-xs text-orange-500" : "text-[10px] sm:text-sm"}`}>
                    {period === "special" ? "特" : period}
                  </span>
                </div>

                {weekDates.map((targetDate, i) => {
                  const targetDateStr = formatYYYYMMDD(targetDate);

                  // 日付(date)と時限(period)が完全に一致するデータを抽出
                  const cellClass = classes.find((c) => c.date === targetDateStr && c.period === period);

                  if (!cellClass) {
                    return (
                      <div
                        key={`${targetDateStr}-${period}`}
                        className="border border-gray-100 bg-gray-50/20 rounded sm:rounded-xl min-h-[55px] xs:min-h-[65px] sm:min-h-[100px]"
                      />
                    );
                  }

                  const style = CATEGORY_STYLES[cellClass.category] || CATEGORY_STYLES.default;

                  return (
                    <button
                      key={cellClass.id}
                      onClick={() => {
                        setSelectedClass(cellClass);
                        setIsEditing(false); 
                      }}
                      className={`relative border sm:border-2 rounded sm:rounded-xl p-1 sm:p-2.5 min-h-[55px] xs:min-h-[65px] sm:min-h-[100px] flex flex-col text-left transition-transform hover:scale-[1.02] overflow-hidden cursor-pointer ${style.border} ${style.bg}`}
                    >
                      <span className={`font-bold text-[8.5px] xs:text-[9.5px] sm:text-xs md:text-sm leading-tight line-clamp-3 sm:line-clamp-none break-all ${style.text}`}>
                        {cellClass.title}
                      </span>
                      {cellClass.room && (
                        <span className="hidden sm:block text-[10px] md:text-[11px] mt-1 text-gray-400 font-bold truncate">
                          {cellClass.room}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
            <p className="text-center text-[9px] text-gray-400 mt-3 sm:hidden">
              ※コマをタップすると詳細確認・編集が可能です
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white min-h-screen font-sans">
      {!selectedClass && (
        <div className="px-4 sm:px-6 py-5 border-b border-orange-50 sticky top-0 bg-white z-20">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">学校</h2>
            <div className="flex gap-2">
              <button className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors">
                <Menu size={18} strokeWidth={2} />
              </button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            <TabButton active={activeTab === "timetable"} onClick={() => setActiveTab("timetable")} icon={<Calendar size={16} />} label="時間割" />
            <TabButton active={activeTab === "syllabus"} onClick={() => setActiveTab("syllabus")} icon={<ClipboardList size={16} />} label="シラバス" />
            <TabButton active={activeTab === "articles"} onClick={() => setActiveTab("articles")} icon={<BookOpen size={16} />} label="勉強系記事" />
          </div>
        </div>
      )}
      <div className={`bg-[#FFF9FA] ${!selectedClass ? "p-2 sm:p-6" : ""}`}>
        {activeTab === "timetable" && (selectedClass ? renderDetailView() : renderTimetableGrid())}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; }) {
  return (
    <button onClick={onClick} className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${active ? "bg-orange-500 text-white shadow-md" : "bg-white text-gray-600 border border-gray-200 hover:bg-orange-50"}`}>
      {icon}
      {label}
    </button>
  );
}