"use client";

import { MapPin, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DetailScaffold } from "@/components/ui/DetailScaffold";
import type { TimetableClassDto } from "@/lib/timetable-dto";
import { DAY_ACCENTS, formatClassTime } from "./school-workspace-shared";

type SchoolClassDetailViewProps = {
  selectedClass: TimetableClassDto;
  isLoggedIn: boolean;
  isSelectedInMyTimetable: boolean;
  isMutating: boolean;
  onBack: () => void;
  onLogin: () => void;
  onToggleClass: () => void;
};

export function SchoolClassDetailView({
  selectedClass,
  isLoggedIn,
  isSelectedInMyTimetable,
  isMutating,
  onBack,
  onLogin,
  onToggleClass,
}: SchoolClassDetailViewProps) {
  return (
    <DetailScaffold
      title="授業の詳細"
      backLabel="前の画面へ戻る"
      onBack={onBack}
      bottomBar={
        !isLoggedIn ? (
          <Button size="lg" fullWidth onClick={onLogin}>
            ログインして時間割に追加
          </Button>
        ) : (
          <Button
            size="lg"
            fullWidth
            variant={isSelectedInMyTimetable ? "secondary" : "primary"}
            disabled={isMutating}
            onClick={onToggleClass}
          >
            {isMutating ? "更新中..." : isSelectedInMyTimetable ? "マイ時間割から削除" : "マイ時間割に追加"}
          </Button>
        )
      }
    >
      {/* h1 (授業名) が最初に来る。以前は h2「授業の詳細」が h1 より前に出ていた。 */}
      <div className={`rounded-card border p-5 ${DAY_ACCENTS[selectedClass.day]}`}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <span className="rounded-pill bg-surface-card/70 px-3 py-1 text-meta font-bold">
            {selectedClass.day}曜 {formatClassTime(selectedClass)}
          </span>
          <span className="rounded-pill bg-surface-card/70 px-2 py-1 text-micro font-bold">
            {selectedClass.isOfficial ? "公式" : "ユーザー編集"}
          </span>
        </div>

        <h1 className="mb-3 text-h1 font-bold leading-snug">{selectedClass.title}</h1>

        <div className="space-y-2 text-body">
          {selectedClass.instructor ? (
            <p className="flex items-center gap-2">
              <UserRound size={15} aria-hidden="true" /> {selectedClass.instructor}
            </p>
          ) : null}
          {selectedClass.room || selectedClass.location ? (
            <p className="flex items-center gap-2">
              <MapPin size={15} aria-hidden="true" />{" "}
              {[selectedClass.room, selectedClass.location].filter(Boolean).join(" / ")}
            </p>
          ) : null}
          {selectedClass.universityName ? (
            <p className="text-meta opacity-70">
              {selectedClass.universityName} / {selectedClass.academicYear ?? "年度未設定"}年度 第
              {selectedClass.termNumber ?? "-"}ターム
            </p>
          ) : null}
        </div>
      </div>
    </DetailScaffold>
  );
}
