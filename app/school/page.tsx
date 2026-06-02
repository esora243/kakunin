"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Calendar, Clock, ChevronRight, ChevronLeft, Menu, BookOpen, Loader2,
  ClipboardList, CalendarDays, X, Save, Edit2, MapPin
} from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";

// =============================================================
// DB(CSV)の生データをそのまま受け取る型
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
};

const CATEGORY_STYLES: Record<string, { border: string; bg: string; text: string; pill: string }> = {
  形態系: { border: "border-orange-200", bg: "bg-orange-50", text: "text-orange-700", pill: "bg-orange-50 text-orange-600 border-orange-100" },
  機能系: { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-700", pill: "bg-blue-50 text-blue-600 border-blue-100" },
  生化学: { border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-700", pill: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  病理: { border: "border-rose-200", bg: "bg-rose-50", text: "text-rose-700", pill: "bg-rose-50 text-rose-600 border-rose-100" },
  臨床: { border: "border-teal-200", bg: "bg-teal-50", text: "text-teal-700", pill: "bg-teal-50 text-teal-600 border-teal-100" },
  default: { border: "border-gray-200", bg: "bg-gray-50/50", text: "text-gray-700", pill: "bg-gray-100 text-gray-600 border-gray-200" },
};

function autoDetectCategory(subject: string): string {
  if (!subject) return "default";
  if (subject.includes("病理")) return "病理";
  if (subject.includes("薬理") || subject.includes("生理")) return "機能系";
  if (subject.includes("解剖")) return "形態系";
  if (subject.includes("生化学")) return "生化学";
  if (subject.includes("臨床") || subject.includes("PBL") || subject.includes("試験") || subject.includes("討論") || subject.includes("内科学")) return "臨床";
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

export default function SchoolPage() {
  const [activeTab, setActiveTab] = useState<"timetable" | "syllabus" | "articles">("timetable");
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassData[]>([]);
  
  // CSVデータの開始週を初期表示に設定
  const [currentDate, setCurrentDate] = useState(new Date("2026-04-13T00:00:00"));
  const weekDates = useMemo(() => getWeekDates(new Date(currentDate)), [currentDate]);
  
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ClassData>>({});
  const [isSaving, setIsSaving] = useState(false);

  // APIを介さず、Supabaseから直接全データを取得
  const fetchClasses = async () => {
    setLoading(true);
    try {
      const res = await supabaseRestFetch<any[]>({ path: "timetable_classes?select=*" });
      
      let rawData: any[] = [];
      if (Array.isArray(res)) {
        rawData = res;
      } else if (res && typeof res === "object" && Array.isArray((res as any).data)) {
        rawData = (res as any).data;
      }

      if (rawData.length > 0) {
        setClasses(
          rawData.map((c) => {
            const startTime = c.time_start ? c.time_start.substring(0, 5) : "";
            const endTime = c.time_end ? c.time_end.substring(0, 5) : "";
            const dateStr = c.date ? c.date.split("T")[0] : "";

            return {
              id: String(c.id),
              title: c.subject || "（科目名なし）",
              category: autoDetectCategory(c.subject || ""),
              day: c.day_of_week || "",
              date: dateStr,
              period: String(c.period || ""),
              room: c.room || "",
              professor: c.teacher || "",
              timeStart: startTime,
              timeEnd: endTime,
              timeDisplay: startTime && endTime ? `${startTime} - ${endTime}` : startTime || endTime || "時間未設定",
            };
          })
        );
      }
    } catch (error) {
      console.error("時間割取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

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
      await fetchClasses(); 
      setSelectedClass(null);
      setIsEditing(false);
    } catch (error) {
      alert("保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  const renderDetailView = () => {
    if (!selectedClass) return null;
    const style = CATEGORY_STYLES[selectedClass.category] || CATEGORY_STYLES.default;
    return (
      <div className="bg-white min-h-[800px] animate-fade-in pb-20">
        <div className="flex items-center justify-between px-4 py-4 mb-2 border-b border-gray-100">
          <button onClick={() => isEditing ? setIsEditing(false) : setSelectedClass(null)} className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50">
            {isEditing ? <X size={24} /> : <ChevronLeft size={24} />}
          </button>
          <h2 className="text-base font-bold text-gray-800">{isEditing ? "授業の編集" : "授業の詳細"}</h2>
          {!isEditing ? (
            <button onClick={() => { setEditForm({ ...selectedClass }); setIsEditing(true); }} className="w-10 h-10 flex items-center justify-center rounded-full border border-orange-200 text-orange-500 hover:bg-orange-50">
              <Edit2 size={18} />
            </button>
          ) : <div className="w-10 h-10" />}
        </div>
        <div className="px-6 pt-4">
          {isEditing ? (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">授業名</label>
                <input type="text" value={editForm.title || ""} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 font-bold" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-gray-500 mb-1.5">開始時間</label><input type="time" value={editForm.timeStart || ""} onChange={(e) => setEditForm({ ...editForm, timeStart: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 font-bold" /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1.5">終了時間</label><input type="time" value={editForm.timeEnd || ""} onChange={(e) => setEditForm({ ...editForm, timeEnd: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 font-bold" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-gray-500 mb-1.5">教室</label><input type="text" value={editForm.room || ""} onChange={(e) => setEditForm({ ...editForm, room: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 font-bold" /></div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">時限枠</label>
                  <select value={editForm.period || "1"} onChange={(e) => setEditForm({ ...editForm, period: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 font-bold">
                    {ROW_PERIODS.map(p => <option key={p} value={p}>{p === "special" ? "特別枠" : `${p}限`}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">担当教員</label>
                <input type="text" value={editForm.professor || ""} onChange={(e) => setEditForm({ ...editForm, professor: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 font-bold" />
              </div>
              <div className="pt-6 flex gap-3">
                <button onClick={() => setIsEditing(false)} className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-bold">キャンセル</button>
                <button onClick={handleSaveClass} disabled={isSaving} className="flex-1 py-3.5 bg-orange-500 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                  {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} 保存する
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold border mb-4 ${style.pill}`}>{selectedClass.category}</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">{selectedClass.title}</h1>
              <p className="text-sm font-bold text-gray-600 mb-8">{selectedClass.date.replace(/-/g, "/")} ({selectedClass.day}) ・ {selectedClass.period === "special" ? "特別枠" : `${selectedClass.period}限`}</p>
              <h3 className="text-sm font-bold text-gray-800 mb-4">授業情報</h3>
              <div className="bg-gray-50 rounded-2xl p-5 mb-6 space-y-4 border border-gray-100">
                <div className="flex items-center gap-4"><Clock size={16} className="text-gray-400" /><span className="text-sm text-gray-700 font-medium">{selectedClass.timeDisplay}</span></div>
                <div className="flex items-center gap-4"><MapPin size={16} className="text-gray-400" /><span className="text-sm text-gray-700 font-medium">{selectedClass.room || "場所未設定"}</span></div>
                <div className="flex items-center gap-4"><BookOpen size={16} className="text-gray-400" /><span className="text-sm text-gray-700 font-medium">{selectedClass.professor || "教員未設定"}</span></div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderTimetableGrid = () => {
    return (
      <div className="bg-white p-1.5 sm:p-6 rounded-xl sm:rounded-2xl border border-orange-50 shadow-sm animate-fade-in w-full">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)))} className="p-1 hover:bg-gray-50 rounded-full"><ChevronLeft size={20} className="text-gray-400" /></button>
          <div className="flex flex-col sm:flex-row items-center gap-1">
            <div className="relative group flex items-center cursor-pointer">
              <input type="date" value={formatYYYYMMDD(currentDate)} onChange={(e) => e.target.value && setCurrentDate(new Date(e.target.value))} className="absolute inset-0 opacity-0 cursor-pointer w-full z-10" />
              <h3 className="text-sm sm:text-lg font-bold text-gray-800 flex items-center gap-1">
                {currentDate.getFullYear()}年{currentDate.getMonth() + 1}月
                <CalendarDays size={16} className="text-gray-400" />
              </h3>
            </div>
            <button onClick={() => setCurrentDate(new Date("2026-04-13T00:00:00"))} className="text-[9px] font-bold px-3 py-0.5 bg-orange-50 text-orange-600 border border-orange-100 rounded-full active:scale-95 transition-transform">開始週に戻る</button>
          </div>
          <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)))} className="p-1 hover:bg-gray-50 rounded-full"><ChevronRight size={20} className="text-gray-400" /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={40} /></div>
        ) : (
          <div className="w-full">
            <div className="grid grid-cols-[18px_repeat(5,1fr)] sm:grid-cols-[28px_repeat(5,1fr)] gap-0.5 sm:gap-2 mb-2">
              <div />
              {weekDates.map((date, i) => (
                <div key={i} className="text-center flex flex-col items-center">
                  <span className={`text-[10px] sm:text-base font-bold text-gray-800`}>{date.getDate()}</span>
                  <div className={`text-[9px] sm:text-xs font-bold w-4 h-4 sm:w-7 sm:h-7 rounded-full flex items-center justify-center mt-0.5 text-gray-500`}>{DAYS[i]}</div>
                </div>
              ))}
            </div>

            {ROW_PERIODS.map((period) => (
              <div key={period} className="grid grid-cols-[18px_repeat(5,1fr)] sm:grid-cols-[28px_repeat(5,1fr)] gap-0.5 sm:gap-2 mb-0.5 sm:mb-2">
                <div className="flex flex-col items-center justify-center text-gray-400 h-full">
                  <span className={`font-bold leading-none ${period === "special" ? "text-[8px] sm:text-xs text-orange-500" : "text-[10px] sm:text-sm"}`}>{period === "special" ? "特" : period}</span>
                </div>

                {weekDates.map((targetDate) => {
                  const targetDateStr = formatYYYYMMDD(targetDate);
                  // 日付(YYYY-MM-DD)と時限の完全一致でデータを抽出
                  const cellClass = classes.find((c) => c.date === targetDateStr && c.period === period);

                  if (!cellClass) {
                    return <div key={`${targetDateStr}-${period}`} className="border border-gray-100 bg-gray-50/10 rounded min-h-[52px] xs:min-h-[62px] sm:min-h-[100px]" />;
                  }

                  const style = CATEGORY_STYLES[cellClass.category] || CATEGORY_STYLES.default;
                  return (
                    <button
                      key={cellClass.id}
                      onClick={() => { setSelectedClass(cellClass); setIsEditing(false); }}
                      className={`relative border rounded sm:rounded-xl p-0.5 sm:p-2.5 min-h-[52px] xs:min-h-[62px] sm:min-h-[100px] flex flex-col text-left transition-transform hover:scale-[1.02] overflow-hidden ${style.border} ${style.bg}`}
                    >
                      <span className={`font-bold text-[8px] xs:text-[9px] sm:text-xs md:text-sm leading-tight line-clamp-3 break-all ${style.text}`}>{cellClass.title}</span>
                      {cellClass.room && <span className="hidden sm:block text-[10px] text-gray-400 font-bold truncate mt-1">{cellClass.room}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
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
            <button onClick={fetchClasses} className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 active:scale-95 transition-transform"><Menu size={18} /></button>
          </div>
          <div className="flex gap-2 pb-1">
            <button className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-orange-500 text-white shadow-md">
              <Calendar size={16} />時間割
            </button>
          </div>
        </div>
      )}
      <div className={`bg-[#FFF9FA] ${!selectedClass ? "p-2 sm:p-6" : ""}`}>
        {selectedClass ? renderDetailView() : renderTimetableGrid()}
      </div>
    </div>
  );
}