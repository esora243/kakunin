"use client";

import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { SearchInput } from "@/components/ui/SearchInput";
import type { TimetableClassDto } from "@/lib/timetable-dto";

type SchoolSyllabusTabProps = {
  searchQuery: string;
  syllabusUrl: string;
  loadingSharedClasses: boolean;
  sharedClassesError: string | null;
  syllabusClasses: TimetableClassDto[];
  myClassIds: Set<string>;
  mutatingClassIds: Set<string>;
  authHydrated: boolean;
  isLoggedIn: boolean;
  onSearchQueryChange: (value: string) => void;
  onSelectClass: (item: TimetableClassDto) => void;
  onToggleClass: (classId: string, inMyTimetable: boolean) => void;
};

export function SchoolSyllabusTab({
  searchQuery,
  syllabusUrl,
  loadingSharedClasses,
  sharedClassesError,
  syllabusClasses,
  myClassIds,
  mutatingClassIds,
  authHydrated,
  isLoggedIn,
  onSearchQueryChange,
  onSelectClass,
  onToggleClass,
}: SchoolSyllabusTabProps) {
  return (
    <div className="space-y-4">
      <SearchInput
        label="授業名・教員・教室で検索"
        clearLabel="授業検索をクリア"
        placeholder="授業名・教員・教室で検索"
        value={searchQuery}
        onChange={onSearchQueryChange}
      />

      {syllabusUrl ? (
        <div className="relative h-72 w-full overflow-hidden rounded-card border border-subtle bg-surface-inset shadow-card">
          <iframe
            src={syllabusUrl}
            title="大学シラバス"
            className="relative z-10 h-full w-full border-none bg-surface-card"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      ) : null}

      {loadingSharedClasses ? (
        <LoadingState label="授業データを読み込んでいます" />
      ) : sharedClassesError ? (
        <ErrorState
          title="授業データを取得できませんでした"
          description="通信状態を確認して、もう一度お試しください。"
          detail={sharedClassesError}
          icon={Calendar}
        />
      ) : syllabusClasses.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title={searchQuery.trim() ? "条件に合う授業は見つかりませんでした" : "授業データはまだ登録されていません"}
          description={
            searchQuery.trim()
              ? "キーワードを変えると見つかるかもしれません。"
              : "授業が登録されると、ここから時間割に追加できます。"
          }
        />
      ) : (
        <div className="space-y-3">
          {syllabusClasses.map((item) => {
            const inMyTimetable = myClassIds.has(item.id);
            const mutating = mutatingClassIds.has(item.id);
            return (
              <Card key={item.id} interactive className="p-4">
                <button
                  type="button"
                  onClick={() => onSelectClass(item)}
                  className="w-full rounded-control text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-body font-bold leading-snug text-primary">{item.title}</span>
                      <span className="mt-1 block text-meta text-secondary">{item.instructor || "教員未設定"}</span>
                    </span>
                    <span className="shrink-0 rounded-pill bg-brand-50 px-2 py-1 text-micro font-bold text-brand-600">
                      {item.day}
                      {item.period}
                    </span>
                  </span>
                  <span className="mt-3 block text-meta text-tertiary">
                    {[item.room, item.location].filter(Boolean).join(" / ") || "教室未設定"}
                  </span>
                </button>

                <Button
                  size="sm"
                  fullWidth
                  variant={inMyTimetable ? "secondary" : "primary"}
                  className="mt-3"
                  disabled={mutating || !authHydrated}
                  onClick={() => onToggleClass(item.id, inMyTimetable)}
                >
                  {mutating
                    ? "更新中..."
                    : inMyTimetable
                      ? "マイ時間割から削除"
                      : isLoggedIn
                        ? "マイ時間割に追加"
                        : "ログインして追加"}
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
