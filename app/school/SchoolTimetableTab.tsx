"use client";

import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import type { TimetableClassDto, TimetableDay, TimetableGridDto } from "@/lib/timetable-dto";
import {
  STATUS_DOTS,
  SUBJECT_CATEGORY_STYLES,
  classifySubject,
  findNextTimetableClass,
  formatWeekLabel,
  getWeekDates,
} from "./school-workspace-shared";

type SchoolTimetableTabProps = {
  authHydrated: boolean;
  loadingMyTimetable: boolean;
  isLoggedIn: boolean;
  myTimetableError: string | null;
  hasTimetable: boolean;
  days: TimetableDay[];
  periods: number[];
  timetableGrid: TimetableGridDto;
  onLogin: () => void;
  onOpenSyllabus: () => void;
  onSelectClass: (item: TimetableClassDto) => void;
};

export function SchoolTimetableTab({
  authHydrated,
  loadingMyTimetable,
  isLoggedIn,
  myTimetableError,
  hasTimetable,
  days,
  periods,
  timetableGrid,
  onLogin,
  onOpenSyllabus,
  onSelectClass,
}: SchoolTimetableTabProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  const referenceDate = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + weekOffset * 7);
    return base;
  }, [weekOffset]);

  const weekLabel = useMemo(() => formatWeekLabel(referenceDate), [referenceDate]);
  const weekDates = useMemo(() => getWeekDates(referenceDate, days), [referenceDate, days]);
  const today = useMemo(() => new Date(), []);
  const nextClass = useMemo(() => findNextTimetableClass(timetableGrid, today), [timetableGrid, today]);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const hasAnyClass = useMemo(() => {
    if (!hasTimetable) return false;
    return days.some((day) => periods.some((period) => timetableGrid[day]?.[period]));
  }, [hasTimetable, days, periods, timetableGrid]);

  // API が返す曜日をそのまま描画する。以前は定義に土日があるのに描画は
  // `days.slice(0, 5)` の平日固定で、定義と描画が食い違っていた。
  const gridColumns = { gridTemplateColumns: `28px repeat(${days.length}, minmax(0, 1fr))` };

  return (
    <div className="space-y-3">
      <div className="mb-1 flex items-center justify-between">
        <IconButton label="前の週" onClick={() => setWeekOffset((value) => value - 1)}>
          <ChevronLeft size={20} aria-hidden="true" />
        </IconButton>
        <div className="text-center">
          <span className="block text-body font-bold text-primary">{weekLabel}</span>
          {!isLoggedIn ? <span className="block text-micro text-tertiary">共有授業を閲覧中</span> : null}
        </div>
        <IconButton label="次の週" onClick={() => setWeekOffset((value) => value + 1)}>
          <ChevronRight size={20} aria-hidden="true" />
        </IconButton>
      </div>

      {!authHydrated || loadingMyTimetable ? (
        <LoadingState label="時間割を読み込んでいます" />
      ) : !isLoggedIn && !hasAnyClass ? (
        <EmptyState
          icon={Calendar}
          title="マイ時間割にはログインが必要です"
          description="シラバスから授業を探すことはできます。"
          action={<Button onClick={onLogin}>ログインする</Button>}
        />
      ) : myTimetableError ? (
        <ErrorState
          title="マイ時間割を取得できませんでした"
          description="通信状態を確認して、もう一度お試しください。"
          detail={myTimetableError}
          icon={Calendar}
        />
      ) : (
        <>
          {nextClass ? (
            <button
              type="button"
              onClick={() => onSelectClass(nextClass)}
              className="w-full rounded-card border border-subtle bg-brand-50 p-4 text-left shadow-card transition-shadow hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <span className="block text-meta font-bold text-brand-600">次の授業</span>
              <span className="mt-1 block text-body font-bold text-primary">{nextClass.title}</span>
              <span className="mt-1 block text-meta text-secondary">
                {nextClass.day}曜 {nextClass.period}限{nextClass.room ? `・${nextClass.room}` : ""}
              </span>
            </button>
          ) : (
            <Card className="bg-surface-inset p-4 text-body text-secondary">今後の授業は登録されていません</Card>
          )}

          <div>
            <div className="mb-2 grid gap-1" style={gridColumns}>
              <div />
              {days.map((day) => {
                const date = weekDates[day];
                const isToday = date ? isSameDay(date, today) : false;
                return (
                  <div key={day} className="flex flex-col items-center text-center">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-pill text-body font-bold ${
                        isToday ? "bg-brand-500 text-inverse" : "text-primary"
                      }`}
                    >
                      {date?.getDate() ?? ""}
                    </span>
                    <span
                      className={`mt-0.5 text-micro font-medium ${isToday ? "text-brand-500" : "text-secondary"}`}
                    >
                      {day}
                    </span>
                  </div>
                );
              })}
            </div>

            {periods.map((period) => (
              <div key={period} className="mb-1 grid gap-1" style={gridColumns}>
                <div className="flex flex-col items-center justify-center text-micro text-tertiary">
                  <span className="font-bold text-secondary">{period}</span>
                  <span className="scale-75">限</span>
                </div>
                {days.map((day) => {
                  const cell = timetableGrid[day]?.[period];
                  if (!cell) {
                    return (
                      <div
                        key={`${day}-${period}`}
                        className="min-h-cell rounded-control border border-subtle bg-surface-card"
                      />
                    );
                  }

                  // 「続き」セル: 同じ授業が前の限にもある場合は薄く表示
                  const previous = timetableGrid[day]?.[period - 1];
                  const isContinuation = previous && previous.id === cell.id;
                  const style = SUBJECT_CATEGORY_STYLES[classifySubject(cell.title)];

                  return (
                    <button
                      key={`${day}-${period}`}
                      type="button"
                      onClick={() => onSelectClass(cell)}
                      className={`relative flex min-h-cell flex-col rounded-control border p-1.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${style.border} ${style.bg} ${style.text}`}
                    >
                      {isContinuation ? (
                        <span className="text-micro font-medium leading-tight opacity-60">(続き)</span>
                      ) : (
                        <>
                          <span className="line-clamp-2 text-caption font-bold leading-tight tracking-tight">
                            {cell.title}
                          </span>
                          {cell.room ? (
                            <span className="mt-1 line-clamp-1 text-micro leading-tight opacity-70">{cell.room}</span>
                          ) : null}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pb-2 pt-4 text-micro text-secondary">
            {(["anatomy", "physiology", "biochem", "pathology", "clinical"] as const).map((key) => (
              <span key={key} className="flex items-center gap-1">
                <span className={`h-2.5 w-2.5 rounded-badge ${SUBJECT_CATEGORY_STYLES[key].dot}`} aria-hidden="true" />
                {SUBJECT_CATEGORY_STYLES[key].label}
              </span>
            ))}
            {STATUS_DOTS.map((dot) => (
              <span key={dot.key} className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-pill ${dot.className}`} aria-hidden="true" />
                {dot.label}
              </span>
            ))}
          </div>

          {isLoggedIn && !hasAnyClass ? (
            <EmptyState
              icon={Calendar}
              title="マイ時間割はまだ空です"
              description="シラバスから授業を追加すると、ここに表示されます。"
              action={<Button onClick={onOpenSyllabus}>授業を探す</Button>}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
