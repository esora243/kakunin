"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
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

// =============================================================
// 型定義 (共通の TimetableClassDto 構造に完全準拠)
// =============================================================
type ClassData = {
  id: string;
  title: string;       // 授業名
  category: string;    // 色分け用
  day: string;         // 曜日 ("月"〜"金")
  period: number;      // 時限 (1〜6, または 7=特別枠)
  room: string;        // 教室
  professor: string;   // 担当教員
  timeDisplay: string; // 表示用時刻
  startsAt: string;
  endsAt: string;
};

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
  if (subject.includes("臨床") || subject.includes("PBL") || subject.includes("試験") || subject.includes("討論")) return "臨床";
  return "default";
}

const DAYS = ["月", "火", "水", "木", "金"] as const;
const PERIODS = [1, 2, 3, 4, 5, 6, 7] as const; // 7はSpecial(特)枠

export default function SchoolPage() {
  const [activeTab, setActiveTab] = useState<"timetable" | "syllabus" | "articles">("timetable");
  const [loading, setLoading] = useState(true);
  
  // 専用APIから最適化されたグリッドデータを保持
  const [timetableGrid, setTimetableGrid] = useState<Record<string, Record<number, ClassData>>>({});
  
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ClassData>>({});
  const [isSaving, setIsSaving] = useState(false);

  // ============================================================
  // キャッシュを強制回避して専用APIルートからデータを取り直す関数
  // ============================================================
  const fetchTimetableData = useCallback(async () => {
    setLoading(true);
    try {
      // ランダムなクエリパラメータを付与してブラウザ・Vercelの304キャッシュを強制突破
      const response = await fetch(`/api/timetable?nocache=${Date.now()}`, {
        cache: "no-store",
        headers: { "Pragma": "no-cache", "Cache-Control": "no-cache" }
      });
      const data = await response.json();
      
      if (data.ok && data.grid) {
        // APIから返ってきた各講義データにフロント用の色分けを施す
        const processedGrid: any = {};
        DAYS.forEach(day => {
          processedGrid[day] = {};
          PERIODS.forEach(p => {
            const item = data.grid[day]?.[p];
            if (item) {
              processedGrid[day][p] = {
                id: item.id,
                title: item.title,
                category: autoDetectCategory(item.title),
                day: item.day,
                period: item.period,
                room: item.room || "",
                professor: item.instructor || "",
                startsAt: item.startsAt || "",
                endsAt: item.endsAt || "",
                timeDisplay: item.startsAt && item.endsAt ? `${item.startsAt} - ${item.endsAt}` : "時間未設定"
              };
            }
          });
        });
        setTimetableGrid(processedGrid);
      }
    } catch (error) {
      console.error("時間割API取得エラー:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初回ロード
  useEffect(() => {
    fetchTimetableData();
  }, [fetchTimetableData]);

  // ============================================================
  // 詳細ページの編集保存処理 (PATCH)
  // ============================================================
  const handleSaveClass = async () => {
    if (!selectedClass) return;
    setIsSaving(true);
    
    try {
      // データベースのカラムに準拠したPATCH処理
      await supabaseRestFetch<any>({
        path: `timetable_classes?id=eq.${selectedClass.id}`,
        method: "PATCH",
        body: {
          subject: editForm.title,
          room: editForm.room,
          teacher: editForm.professor,
          time_start: editForm.startsAt ? `${editForm.startsAt}:00` : null,
          time_end: editForm.endsAt ? `${editForm.endsAt}:00` : null,
        },
      });

      // 保存が成功したら、即座にAPI経由で最新のDBをクリーン再取得（キャッシュの完全破棄）
      await fetchTimetableData();
      
      // 詳細モーダルの表示情報も更新して編集モードを閉じる
      setSelectedClass((prev) => prev ? {
        ...prev,
        title: editForm.title || "",
        room: editForm.room || "",
        professor: editForm.professor || "",
        startsAt: editForm.startsAt || "",
        endsAt: editForm.endsAt || "",
        timeDisplay: editForm.startsAt && editForm.endsAt ? `${editForm.startsAt} - ${editForm.endsAt}` : "時間未設定",
        category: autoDetectCategory(editForm.title || ""),
      } : null);
      
      setIsEditing(false);
    } catch (error) {
      console.error("更新エラー:", error);
      alert("データの保存に失敗しました。");
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
            onClick={() => isEditing ? setIsEditing(false) : setSelectedClass(null)}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
          >
            {isEditing ? <X size={24} /> : <ChevronLeft size={24} />}
          </button>
          <h2 className="text-base font-bold text-gray-800">{isEditing ? "授業の編集" : "授業の詳細"}</h2>
          {!isEditing ? (
            <button 
              onClick={() => { setEditForm({ ...selectedClass }); setIsEditing(true); }}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-orange-200 text-orange-500 hover:bg-orange-50 transition-colors"
            >
              <Edit2 size={18} />
            </button>
          ) : <div className="w-10 h-10" />}
        </div>

        <div className="px-6 pt-4">
          {isEditing ? (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">授業名 (subject)</label>
                <input type="text" value={editForm.title || ""} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 font-bold" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">開始時間</label>
                  <input type="time" value={editForm.startsAt || ""} onChange={(e) => setEditForm({ ...editForm, startsAt: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">終了時間</label>
                  <input type="time" value={editForm.endsAt || ""} onChange={(e) => setEditForm({ ...editForm, endsAt: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 font-bold" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">教室 (room)</label>
                <input type="text" value={editForm.room || ""} onChange={(e) => setEditForm({ ...editForm, room: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">担当教員 (teacher)</label>
                <input type="text" value={editForm.professor || ""} onChange={(e) => setEditForm({ ...editForm, professor: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 font-bold" />
              </div>
              <div className="pt-6 flex gap-3">
                <button onClick={() => setIsEditing(false)} className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-bold">キャンセル</button>
                <button onClick={handleSaveClass} disabled={isSaving} className="flex-1 py-3.5 bg-orange-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                  {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  保存する
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold border mb-4 ${style.pill}`}>
                {selectedClass.category === "default" ? "一般講義" : selectedClass.category}
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">{selectedClass.title}</h1>
              <p className="text-sm font-bold text-gray-600 mb-8">
                {selectedClass.day}曜日 ・ {selectedClass.period === 7 ? "特別枠(特)" : `${selectedClass.period}限`}
              </p>
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

  // ============================================================
  // 時間割グリッド (完全にAPI同期・スマホ特化型)
  // ============================================================
  const renderTimetableGrid = () => {
    return (
      <div className="bg-white p-1.5 sm:p-6 rounded-xl sm:rounded-2xl border border-orange-50 shadow-sm animate-fade-in w-full">
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-sm sm:text-base font-bold text-gray-700 flex items-center gap-2">
            <CalendarDays size={18} className="text-orange-500" />
            配信中の一括時間割データ
          </h3>
          <button onClick={fetchTimetableData} className="text-[10px] font-bold px-3 py-1 bg-orange-50 text-orange-600 border border-orange-100 rounded-full active:scale-95 transition-transform">
            同期リフレッシュ
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
              {DAYS.map((day) => (
                <div key={day} className="text-center flex flex-col items-center">
                  <div className="text-[10px] sm:text-xs font-bold w-5 h-5 sm:w-8 sm:h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">{day}</div>
                </div>
              ))}
            </div>

            {/* コマ行ループ (1〜6限 + special=7) */}
            {PERIODS.map((period) => (
              <div key={period} className="grid grid-cols-[18px_repeat(5,1fr)] sm:grid-cols-[28px_repeat(5,1fr)] gap-0.5 sm:gap-2 mb-0.5 sm:mb-2">
                <div className="flex flex-col items-center justify-center text-gray-400 h-full">
                  <span className={`font-bold leading-none ${period === 7 ? "text-[8px] sm:text-xs text-orange-500" : "text-[10px] sm:text-sm"}`}>
                    {period === 7 ? "特" : period}
                  </span>
                </div>

                {DAYS.map((day) => {
                  const cellClass = timetableGrid[day]?.[period];

                  if (!cellClass) {
                    return <div key={`${day}-${period}`} className="border border-gray-100 bg-gray-50/10 rounded min-h-[52px] xs:min-h-[62px] sm:min-h-[100px]" />;
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
            <button className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500"><Menu size={18} /></button>
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
    <button onClick={onClick} className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${active ? "bg-orange-500 text-white shadow-md" : "bg-white text-gray-600 border border-gray-200"}`}>
      {icon}
      {label}
    </button>
  );
}