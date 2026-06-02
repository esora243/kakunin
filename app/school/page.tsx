"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar, Clock, ChevronRight, ChevronLeft, Menu, BookOpen, Loader2,
  CalendarDays, X, Save, Edit2, MapPin, ClipboardList, ExternalLink, User, FileText
} from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";

// =============================================================
// 型定義
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

function autoDetectCategory(subject: string): string {
  if (!subject) return "一般";
  if (subject.includes("病理")) return "病理学";
  if (subject.includes("薬理") || subject.includes("生理")) return "機能系医学";
  if (subject.includes("解剖")) return "形態系医学";
  if (subject.includes("生化学")) return "生化学";
  if (subject.includes("臨床") || subject.includes("PBL") || subject.includes("内科学") || subject.includes("外科学")) return "臨床医学";
  return "一般講義";
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
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"timetable" | "syllabus">("timetable");
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassData[]>([]);
  
  // 日付管理
  const [currentDate, setCurrentDate] = useState(new Date("2026-04-13T00:00:00"));
  const weekDates = useMemo(() => getWeekDates(new Date(currentDate)), [currentDate]);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0); // 選択中の曜日 (0=月, 4=金)
  
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [detailInnerTab, setDetailInnerTab] = useState<"detail" | "syllabus" | "materials">("detail");
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ClassData>>({});
  const [isSaving, setIsSaving] = useState(false);

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const res = await supabaseRestFetch<any>({ path: "timetable_classes?select=*" });
      let rawData: any[] = [];
      if (Array.isArray(res)) rawData = res;
      else if (res && typeof res === "object" && Array.isArray((res as any).data)) rawData = (res as any).data;

      if (rawData.length > 0) {
        setClasses(
          rawData.map((c) => {
            const startTime = c.time_start ? c.time_start.substring(0, 5) : "";
            const endTime = c.time_end ? c.time_end.substring(0, 5) : "";
            return {
              id: String(c.id),
              title: c.subject || "（科目名なし）",
              category: autoDetectCategory(c.subject || ""),
              day: c.day_of_week || "",
              date: c.date ? c.date.split("T")[0] : "",
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

  // ============================================================
  // 新デザイン: 詳細ビュー (画像再現)
  // ============================================================
  const renderDetailView = () => {
    if (!selectedClass) return null;

    if (isEditing) {
      return (
        <div className="bg-white min-h-screen animate-fade-in pb-20">
          <header className="flex items-center justify-between px-4 py-4 mb-2 border-b border-gray-100">
            <button onClick={() => setIsEditing(false)} className="p-2 text-gray-500 hover:bg-gray-50 rounded-full"><X size={24} /></button>
            <h2 className="text-base font-bold text-gray-800">授業の編集</h2>
            <div className="w-10"></div>
          </header>
          <div className="px-6 pt-4 space-y-5">
            {/* 編集フォーム (既存のロジックを踏襲) */}
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
            <div className="pt-6">
              <button onClick={handleSaveClass} disabled={isSaving} className="w-full py-4 bg-orange-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm">
                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} 保存して完了
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white min-h-screen animate-fade-in pb-20 font-sans">
        {/* ヘッダー */}
        <header className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <button onClick={() => setSelectedClass(null)} className="p-2 -ml-2 text-gray-600 hover:bg-gray-50 rounded-full transition-colors">
            <ChevronLeft size={26} strokeWidth={2.5} />
          </button>
          <h1 className="font-bold text-gray-900 text-[17px]">講義詳細</h1>
          <button onClick={() => { setEditForm({ ...selectedClass }); setIsEditing(true); }} className="p-2 -mr-2 text-gray-600 hover:bg-gray-50 rounded-full transition-colors">
            <Edit2 size={20} />
          </button>
        </header>

        {/* コンテンツボディ */}
        <div className="p-6">
          <div className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-[11px] font-bold rounded mb-4">
            {selectedClass.category}
          </div>
          
          <h2 className="text-[26px] font-extrabold text-gray-900 mb-3 leading-tight tracking-tight">
            {selectedClass.title}
          </h2>
          
          <p className="text-[13px] font-bold text-gray-400 mb-8 flex items-center gap-1.5">
            {selectedClass.date.replace(/-/g, '/')} ({selectedClass.day}) {selectedClass.period === "special" ? "特別枠" : `${selectedClass.period}限`}
            <span className="ml-2 text-gray-300">•</span>
            <span className="ml-2">{selectedClass.timeDisplay}</span>
          </p>

          {/* アイコン付き情報カード (画像再現) */}
          <div className="space-y-3 mb-10">
            <div className="flex items-center gap-4 bg-[#f8f9fc] p-4 rounded-2xl border border-gray-50">
              <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-sm text-gray-500">
                <MapPin size={20} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-400 mb-0.5">場所</p>
                <p className="text-[15px] font-extrabold text-gray-800">{selectedClass.room || "場所未設定"}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 bg-[#f8f9fc] p-4 rounded-2xl border border-gray-50">
              <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-sm text-gray-500">
                <User size={20} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-400 mb-0.5">教員</p>
                <p className="text-[15px] font-extrabold text-gray-800">{selectedClass.professor || "教員未設定"}</p>
              </div>
            </div>
          </div>

          {/* インナータブ */}
          <div className="flex border-b border-gray-200 mb-6">
            <button 
              onClick={() => setDetailInnerTab("detail")} 
              className={`flex-1 pb-3 text-[14px] font-bold border-b-[3px] transition-colors ${detailInnerTab === "detail" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"}`}
            >
              授業詳細
            </button>
            <button 
              onClick={() => setDetailInnerTab("syllabus")} 
              className={`flex-1 pb-3 text-[14px] font-bold border-b-[3px] transition-colors ${detailInnerTab === "syllabus" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"}`}
            >
              シラバス
            </button>
            <button 
              onClick={() => setDetailInnerTab("materials")} 
              className={`flex-1 pb-3 text-[14px] font-bold border-b-[3px] transition-colors ${detailInnerTab === "materials" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"}`}
            >
              資料
            </button>
          </div>

          {/* タブコンテンツ */}
          <div className="text-[14px] text-gray-600 font-medium leading-relaxed">
            {detailInnerTab === "detail" && (
              <div className="space-y-4 animate-fade-in">
                <p>この授業に関する詳細なトピックや連絡事項が表示されます。</p>
              </div>
            )}
            {detailInnerTab === "syllabus" && (
              <div className="space-y-4 animate-fade-in">
                <p>シラバスシステムと連携した授業目標・評価基準が表示されます。</p>
                <button className="text-blue-600 font-bold flex items-center gap-1"><ExternalLink size={16}/> 公式シラバスを確認</button>
              </div>
            )}
            {detailInnerTab === "materials" && (
              <div className="space-y-4 animate-fade-in">
                <p>配布資料や参考リンクはありません。</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // 新デザイン: 時間割 リストビュー (画像再現)
  // ============================================================
  const renderTimetableGrid = () => {
    const activeDate = weekDates[selectedDayIndex];
    const activeDateStr = formatYYYYMMDD(activeDate);
    
    // 選択された日の授業だけを抽出し、時限順にソート
    const daysClasses = classes
      .filter(c => c.date === activeDateStr)
      .sort((a, b) => {
        const valA = a.period === "special" ? 7 : parseInt(a.period) || 99;
        const valB = b.period === "special" ? 7 : parseInt(b.period) || 99;
        return valA - valB;
      });

    return (
      <div className="bg-[#f8f9fc] min-h-screen pb-24 w-full animate-fade-in">
        
        {/* ウィーク/デイセレクター */}
        <div className="bg-white px-4 pt-4 pb-2 border-b border-gray-100 shadow-sm sticky top-0 z-10">
          <div className="flex justify-between items-center mb-5 px-2">
            <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)))} className="p-1 text-gray-400 hover:bg-gray-50 rounded-full"><ChevronLeft size={20} /></button>
            <div className="flex items-center gap-2">
              <h3 className="text-[16px] font-bold text-gray-800">
                {activeDate.getFullYear()}年{activeDate.getMonth() + 1}月 第{Math.ceil((activeDate.getDate() + (new Date(activeDate.getFullYear(), activeDate.getMonth(), 1).getDay() || 7) - 1) / 7)}週
              </h3>
              <button onClick={() => setCurrentDate(new Date("2026-04-13T00:00:00"))} className="text-[10px] font-bold px-3 py-1 bg-orange-50 text-orange-600 rounded-full">今週</button>
            </div>
            <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)))} className="p-1 text-gray-400 hover:bg-gray-50 rounded-full"><ChevronRight size={20} /></button>
          </div>

          <div className="flex justify-between items-center mb-2">
            {weekDates.map((date, i) => {
              const isSelected = selectedDayIndex === i;
              return (
                <button 
                  key={i} 
                  onClick={() => setSelectedDayIndex(i)} 
                  className={`flex flex-col items-center justify-center w-12 h-14 rounded-xl transition-all ${isSelected ? 'bg-orange-500 text-white shadow-md shadow-orange-200' : 'text-gray-400 hover:bg-gray-50'}`}
                >
                  <span className={`text-[10px] font-bold mb-1 ${isSelected ? 'text-orange-100' : ''}`}>{DAYS[i]}</span>
                  <span className={`text-[18px] font-extrabold ${isSelected ? 'text-white' : 'text-gray-800'}`}>{date.getDate()}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 1日のリスト表示 */}
        <div className="p-4 sm:p-6">
          <div className="mb-4 pl-1">
            <h2 className="text-gray-500 font-bold text-[13px]">{activeDate.getMonth() + 1}/{activeDate.getDate()} {DAYS[activeDate.getDay()-1]}曜日</h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={32} /></div>
          ) : daysClasses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <CalendarDays size={48} className="mb-4 opacity-20" />
              <p className="font-bold text-sm">この日の授業はありません</p>
            </div>
          ) : (
            <div className="space-y-4">
              {daysClasses.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedClass(c); setIsEditing(false); }}
                  className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex relative hover:shadow-md hover:-translate-y-0.5 transition-all text-left group"
                >
                  {/* 左側のアクセントカラー (画像再現) */}
                  <div className="w-1.5 bg-orange-500 absolute left-0 top-0 bottom-0" />
                  
                  <div className="p-4 pl-5 w-full">
                    {/* 上部: 時限と時間 */}
                    <div className="flex items-center gap-3 mb-2.5">
                      <span className="bg-gray-100 text-gray-600 text-[10px] font-extrabold px-2.5 py-1 rounded-full tracking-wider">
                        {c.period === "special" ? "特別枠" : `${c.period}限`}
                      </span>
                      <span className="text-gray-400 text-[12px] font-bold flex items-center gap-1">
                        <Clock size={12} strokeWidth={2.5} />{c.timeDisplay}
                      </span>
                    </div>
                    
                    {/* 中部: 授業名 */}
                    <h3 className="font-extrabold text-gray-900 text-[16px] mb-3 leading-tight group-hover:text-orange-600 transition-colors">
                      {c.title}
                    </h3>
                    
                    {/* 下部: 教員と教室 */}
                    <div className="flex items-center gap-4 text-[12px] text-gray-500 font-bold">
                      <div className="flex items-center gap-1.5"><User size={14} strokeWidth={2.5}/>{c.professor || "未設定"}</div>
                      <div className="flex items-center gap-1.5"><MapPin size={14} strokeWidth={2.5}/>{c.room || "未設定"}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================================
  // シラバス ビュー (外部iframe埋め込み)
  // ============================================================
  const renderSyllabus = () => {
    const syllabusUrl = "https://lcu.hama-med.ac.jp/lcu-web/SC_06001B00_21";

    return (
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm animate-fade-in w-full min-h-[800px] flex flex-col">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <ClipboardList size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">シラバス検索</h2>
            </div>
          </div>
          <a
            href={syllabusUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <ExternalLink size={14} />
            別タブで開く
          </a>
        </div>
        <div className="w-full flex-1 min-h-[700px] bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
          <iframe
            src={syllabusUrl}
            className="w-full h-full border-none"
            title="シラバス"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-md sm:max-w-4xl mx-auto bg-gray-50 min-h-screen font-sans">
      {!selectedClass && (
        <div className="px-4 py-3 border-b border-gray-200 bg-white sticky top-0 z-20">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">学校</h2>
            <button onClick={fetchClasses} className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 active:scale-95 transition-transform"><Menu size={18} /></button>
          </div>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            <TabButton active={activeTab === "timetable"} onClick={() => setActiveTab("timetable")} icon={<Calendar size={15} />} label="時間割" />
            <TabButton active={activeTab === "syllabus"} onClick={() => setActiveTab("syllabus")} icon={<ClipboardList size={15} />} label="シラバス" />
            <TabButton active={false} onClick={() => router.push("/articles?tab=study")} icon={<BookOpen size={15} />} label="勉強系記事" />
          </div>
        </div>
      )}
      
      <div className="w-full">
        {activeTab === "timetable" && (selectedClass ? renderDetailView() : renderTimetableGrid())}
        {activeTab === "syllabus" && renderSyllabus()}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; }) {
  return (
    <button onClick={onClick} className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold transition-all ${active ? "bg-[#ff7a45] text-white shadow-md" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}>
      {icon}
      {label}
    </button>
  );
}