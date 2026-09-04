"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, FileText, Users, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { AuthBoundary } from "@/components/AuthBoundary";
import { useAuth } from "@/components/AuthContext";
import { Container } from "@/components/ui/Container";
import { FilterChip, FilterChipGroup } from "@/components/ui/FilterChip";
import { PageHeader } from "@/components/ui/PageHeader";
import { readRequiredApiJson } from "@/lib/api-client";
import { siteConfig } from "@/lib/site";
import type {
  TimetableClassDto,
  TimetableDay,
  TimetableGridDto,
  UserTimetableResponse,
} from "@/lib/timetable-dto";
import { SchoolClassDetailView } from "./SchoolClassDetailView";
import { SchoolSyllabusTab } from "./SchoolSyllabusTab";
import { SchoolTimetableTab } from "./SchoolTimetableTab";
import { SharedTimetableTab } from "./SharedTimetableTab";
import {
  emptyTimetableGrid,
  isCurrentTimetableRequest,
  type SchoolClassSource,
  type SchoolWorkspaceTab,
  type SchoolWorkspaceView,
} from "./school-workspace-shared";

type MutationSuccess = { ok: true };

type SchoolPageClientProps = {
  initialSharedClasses: TimetableClassDto[];
  initialDays: TimetableDay[];
  initialPeriods: number[];
  initialSharedClassesError: string | null;
};

const TAB_BUTTONS: Array<{ key: SchoolWorkspaceTab; label: string; icon: LucideIcon }> = [
  { key: "timetable", label: "次の情報＋時間割", icon: CalendarDays },
  { key: "syllabus", label: "シラバス", icon: FileText },
  { key: "shared", label: "共有時間割", icon: Users },
];

function SchoolWorkspaceInner({
  initialSharedClasses: sharedClasses,
  initialDays,
  initialPeriods,
  initialSharedClassesError: sharedClassesError,
}: SchoolPageClientProps) {
  const { hydrated: authHydrated, isLoggedIn, me, openLoginModal } = useAuth();
  const userId = me?.id ?? null;
  const [activeTab, setActiveTab] = useState<SchoolWorkspaceTab>("timetable");
  const [view, setView] = useState<SchoolWorkspaceView>("main");
  const [selectedClass, setSelectedClass] = useState<TimetableClassDto | null>(null);
  const [selectedClassSource, setSelectedClassSource] = useState<SchoolClassSource | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [days, setDays] = useState<TimetableDay[]>(initialDays);
  const [periods, setPeriods] = useState(initialPeriods);
  const [myTimetableGrid, setMyTimetableGrid] = useState<TimetableGridDto>(() => emptyTimetableGrid());
  const [myClasses, setMyClasses] = useState<TimetableClassDto[]>([]);
  const [myTimetableUserId, setMyTimetableUserId] = useState<string | null>(null);
  const [loadingMyTimetable, setLoadingMyTimetable] = useState(false);
  const [myTimetableError, setMyTimetableError] = useState<string | null>(null);
  const [mutatingClassIds, setMutatingClassIds] = useState<Set<string>>(() => new Set());
  const myTimetableRequestId = useRef(0);
  const authState = useRef({ authHydrated, isLoggedIn, userId });

  const clearMyTimetable = useCallback(() => {
    setMyClasses([]);
    setMyTimetableGrid(emptyTimetableGrid());
    setMyTimetableUserId(null);
    setMyTimetableError(null);
  }, []);

  useEffect(() => {
    const previousUserId = authState.current.userId;
    authState.current = { authHydrated, isLoggedIn, userId };
    if (!isLoggedIn || previousUserId !== userId) {
      myTimetableRequestId.current += 1;
      clearMyTimetable();
      setLoadingMyTimetable(false);
      if (selectedClassSource === "personal") {
        setSelectedClass(null);
        setSelectedClassSource(null);
        setView("main");
      }
    }
  }, [authHydrated, clearMyTimetable, isLoggedIn, selectedClassSource, userId]);

  const refreshMyTimetable = useCallback(
    async (cancelled?: () => boolean) => {
      const currentAuthAtStart = authState.current;
      if (
        currentAuthAtStart.authHydrated !== authHydrated ||
        currentAuthAtStart.isLoggedIn !== isLoggedIn ||
        currentAuthAtStart.userId !== userId
      ) {
        return;
      }

      if (!authHydrated || !isLoggedIn || !userId) {
        myTimetableRequestId.current += 1;
        clearMyTimetable();
        setLoadingMyTimetable(false);
        return;
      }

      const requestId = myTimetableRequestId.current + 1;
      myTimetableRequestId.current = requestId;
      const requestUserId = userId;
      const isCurrentRequest = () => {
        const currentAuth = authState.current;
        return isCurrentTimetableRequest({
          requestId,
          currentRequestId: myTimetableRequestId.current,
          requestUserId,
          currentAuth,
          cancelled: cancelled?.(),
        });
      };

      setLoadingMyTimetable(true);
      setMyTimetableError(null);
      try {
        const response = await fetch("/api/me/timetable", { cache: "no-store" });
        if (!isCurrentRequest()) return;
        const data = await readRequiredApiJson<UserTimetableResponse>(
          response,
          "マイ時間割の取得に失敗しました",
        );
        if (!isCurrentRequest()) return;
        setDays(data.days);
        setPeriods(data.periods);
        setMyClasses(data.items);
        setMyTimetableGrid(data.grid);
        setMyTimetableUserId(requestUserId);
        return "applied" as const;
      } catch (error) {
        if (!isCurrentRequest()) return;
        clearMyTimetable();
        setMyTimetableError(
          error instanceof Error ? error.message : "マイ時間割の取得に失敗しました",
        );
        return "failed" as const;
      } finally {
        if (requestId === myTimetableRequestId.current) setLoadingMyTimetable(false);
      }
    },
    [authHydrated, clearMyTimetable, isLoggedIn, userId],
  );

  useEffect(() => {
    let cancelled = false;
    void refreshMyTimetable(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [refreshMyTimetable]);

  const syllabusClasses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sharedClasses;
    return sharedClasses.filter((item) =>
      [item.title, item.instructor, item.room, item.location]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [sharedClasses, searchQuery]);

  // ログイン済ならマイ時間割、未ログインなら共有のセルを表示
  const visibleMyClasses = useMemo(
    () => (myTimetableUserId === userId ? myClasses : []),
    [myClasses, myTimetableUserId, userId],
  );
  const visibleMyTimetableGrid = useMemo(
    () => (myTimetableUserId === userId ? myTimetableGrid : emptyTimetableGrid()),
    [myTimetableGrid, myTimetableUserId, userId],
  );

  // 未ログイン時に共有授業を簡易グリッド化（モックの「ログインしなくても枠が見える」体験を踏襲）
  const sharedTimetableGrid = useMemo<TimetableGridDto>(() => {
    const grid = emptyTimetableGrid();
    for (const item of sharedClasses) {
      if (!grid[item.day]) continue;
      if (!grid[item.day][item.period]) grid[item.day][item.period] = item;
    }
    return grid;
  }, [sharedClasses]);

  const displayGrid = isLoggedIn ? visibleMyTimetableGrid : sharedTimetableGrid;
  const myClassIds = useMemo(
    () => new Set(visibleMyClasses.map((item) => item.id)),
    [visibleMyClasses],
  );
  const isSelectedInMyTimetable = selectedClass ? myClassIds.has(selectedClass.id) : false;
  const hasTimetable = isLoggedIn ? visibleMyClasses.length > 0 : sharedClasses.length > 0;

  const selectClass = useCallback((item: TimetableClassDto, source: SchoolClassSource) => {
    setSelectedClass(item);
    setSelectedClassSource(source);
    setView("detail");
  }, []);

  const mutateClass = async (classId: string, action: "add" | "remove") => {
    if (!isLoggedIn || !userId) {
      openLoginModal();
      return;
    }
    if (mutatingClassIds.has(classId)) return;

    const mutationUserId = userId;
    setMutatingClassIds((current) => new Set(current).add(classId));
    try {
      const response = await fetch(
        action === "add"
          ? "/api/me/timetable"
          : `/api/me/timetable/classes/${encodeURIComponent(classId)}`,
        {
          method: action === "add" ? "POST" : "DELETE",
          headers: action === "add" ? { "content-type": "application/json" } : undefined,
          body: action === "add" ? JSON.stringify({ classId }) : undefined,
        },
      );
      await readRequiredApiJson<MutationSuccess>(
        response,
        action === "add" ? "時間割への追加に失敗しました" : "時間割からの削除に失敗しました",
      );
      const currentAuth = authState.current;
      if (!currentAuth.authHydrated || !currentAuth.isLoggedIn || currentAuth.userId !== mutationUserId) return;
      const refreshResult = await refreshMyTimetable();
      if (refreshResult === "applied") {
        toast.success(action === "add" ? "マイ時間割に追加しました" : "マイ時間割から削除しました");
      } else if (refreshResult === "failed") {
        toast.error("時間割は更新されましたが、最新状態を確認できませんでした");
      }
    } catch (error) {
      const currentAuth = authState.current;
      if (!currentAuth.authHydrated || !currentAuth.isLoggedIn || currentAuth.userId !== mutationUserId) return;
      toast.error(error instanceof Error ? error.message : "時間割の更新に失敗しました");
    } finally {
      setMutatingClassIds((current) => {
        const next = new Set(current);
        next.delete(classId);
        return next;
      });
    }
  };

  if (view === "detail" && selectedClass) {
    return (
      <SchoolClassDetailView
        selectedClass={selectedClass}
        isLoggedIn={isLoggedIn}
        isSelectedInMyTimetable={isSelectedInMyTimetable}
        isMutating={mutatingClassIds.has(selectedClass.id)}
        onBack={() => setView("main")}
        onLogin={openLoginModal}
        onToggleClass={() =>
          void mutateClass(selectedClass.id, isSelectedInMyTimetable ? "remove" : "add")
        }
      />
    );
  }

  return (
    // 他ルートと同じ canvas 地の上にカードを置く。/school だけ白地にしない。
    <div className="bg-surface-canvas pb-8">
      {/*
        右上にあった Plus / Search / CalendarDays の 3 ボタンは、いずれも下の
        タブと同じ動作 (実質 2 種類) だったため廃止した。切り替えはタブに一本化する。
      */}
      <PageHeader sticky title="学校" description="時間割とシラバスをまとめて確認">
        <FilterChipGroup label="学校の表示切り替え">
          {TAB_BUTTONS.map((tab) => {
            const Icon = tab.icon;
            return (
              <FilterChip key={tab.key} selected={activeTab === tab.key} onClick={() => setActiveTab(tab.key)}>
                <Icon size={15} aria-hidden="true" />
                <span>{tab.label}</span>
              </FilterChip>
            );
          })}
        </FilterChipGroup>
      </PageHeader>

      <Container className="py-section">
        {activeTab === "timetable" ? (
          <SchoolTimetableTab
            authHydrated={authHydrated}
            loadingMyTimetable={loadingMyTimetable}
            isLoggedIn={isLoggedIn}
            myTimetableError={myTimetableError}
            hasTimetable={hasTimetable}
            days={days}
            periods={periods}
            timetableGrid={displayGrid}
            onLogin={openLoginModal}
            onOpenSyllabus={() => setActiveTab("syllabus")}
            onSelectClass={(item) => selectClass(item, isLoggedIn ? "personal" : "shared")}
          />
        ) : null}

        {activeTab === "syllabus" ? (
          <SchoolSyllabusTab
            searchQuery={searchQuery}
            syllabusUrl={siteConfig.syllabusUrl}
            loadingSharedClasses={false}
            sharedClassesError={sharedClassesError}
            syllabusClasses={syllabusClasses}
            myClassIds={myClassIds}
            mutatingClassIds={mutatingClassIds}
            authHydrated={authHydrated}
            isLoggedIn={isLoggedIn}
            onSearchQueryChange={setSearchQuery}
            onSelectClass={(item) => selectClass(item, "shared")}
            onToggleClass={(classId, inMyTimetable) =>
              void mutateClass(classId, inMyTimetable ? "remove" : "add")
            }
          />
        ) : null}

        {activeTab === "shared" ? (
          <SharedTimetableTab
            authHydrated={authHydrated}
            isLoggedIn={isLoggedIn}
            onLogin={openLoginModal}
          />
        ) : null}
      </Container>
    </div>
  );
}

export function SchoolWorkspaceClient(props: SchoolPageClientProps) {
  return (
    <AuthBoundary>
      <SchoolWorkspaceInner {...props} />
    </AuthBoundary>
  );
}
