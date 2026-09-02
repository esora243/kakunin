"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthContext";
import { readRequiredApiJson } from "@/lib/api-client";
import { savedItemEntityId, type SavedItemDto, type SavedItemType } from "@/lib/saved-items";

type SavedItemsContextType = {
  savedItems: SavedItemDto[];
  hydrated: boolean;
  syncing: boolean;
  error: string | null;
  isSaved: (type: SavedItemType, id: string) => boolean;
  toggleSaved: (type: SavedItemType, id: string) => Promise<boolean>;
  removeSaved: (type: SavedItemType, id: string) => Promise<void>;
  refreshSavedItems: (throwOnError?: boolean) => Promise<void>;
};

type BookmarksSuccess = { ok: true; items: SavedItemDto[] };
type MutationSuccess = { ok: true; saved: boolean };

const SavedItemsContext = createContext<SavedItemsContextType | undefined>(undefined);

const SAVED_ITEM_LABELS: Record<SavedItemType, string> = {
  job: "求人",
  activity: "課外活動",
  content: "コンテンツ",
};

function bookmarkPath(type: SavedItemType, id: string) {
  const segment = type === "job" ? "jobs" : type === "activity" ? "activities" : "contents";
  return `/api/me/bookmarks/${segment}/${encodeURIComponent(id)}`;
}

export function SavedItemsProvider({ children }: { children: ReactNode }) {
  const { hydrated: authHydrated, isLoggedIn, me, openLoginModal } = useAuth();
  const userId = me?.id ?? null;
  const [savedItems, setSavedItems] = useState<SavedItemDto[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const mutations = useRef(new Set<string>());
  const activeUserId = useRef(userId);

  useEffect(() => {
    activeUserId.current = userId;
  }, [userId]);

  const refreshSavedItems = useCallback(async (throwOnError = false) => {
    const currentRequest = ++requestId.current;
    if (!authHydrated || !isLoggedIn || !userId) {
      setSavedItems([]);
      setError(null);
      setHydrated(authHydrated);
      return;
    }
    setSyncing(true);
    setError(null);
    try {
      const response = await fetch("/api/me/bookmarks", { cache: "no-store" });
      const data = await readRequiredApiJson<BookmarksSuccess>(response, "保存済みアイテムの取得に失敗しました");
      if (currentRequest !== requestId.current) return;
      setSavedItems(data.items);
    } catch (caught) {
      if (currentRequest !== requestId.current) return;
      const nextError = caught instanceof Error ? caught : new Error("保存済みアイテムの取得に失敗しました");
      setError(nextError.message);
      if (throwOnError) throw nextError;
    } finally {
      if (currentRequest === requestId.current) {
        setHydrated(true);
        setSyncing(false);
      }
    }
  }, [authHydrated, isLoggedIn, userId]);

  useEffect(() => { void refreshSavedItems(); }, [refreshSavedItems]);

  const isSaved = useCallback(
    (type: SavedItemType, id: string) => savedItems.some((item) => item.type === type && savedItemEntityId(item) === id),
    [savedItems],
  );

  const mutate = useCallback(async (type: SavedItemType, id: string, method: "POST" | "DELETE", mutationUserId: string) => {
    const key = `${type}:${id}`;
    if (mutations.current.has(key)) throw new Error("保存操作を処理中です");
    mutations.current.add(key);
    try {
      const response = await fetch(bookmarkPath(type, id), { method });
      await readRequiredApiJson<MutationSuccess>(response, "保存状態の更新に失敗しました");
      if (activeUserId.current !== mutationUserId) return false;
      await refreshSavedItems(true);
      return activeUserId.current === mutationUserId;
    } finally {
      mutations.current.delete(key);
    }
  }, [refreshSavedItems]);

  const toggleSaved = useCallback(async (type: SavedItemType, id: string) => {
    if (!isLoggedIn || !userId) { openLoginModal(); return false; }
    const nextSaved = !isSaved(type, id);
    try {
      const applied = await mutate(type, id, nextSaved ? "POST" : "DELETE", userId);
      if (!applied) return !nextSaved;
      const label = SAVED_ITEM_LABELS[type];
      toast.success(nextSaved ? `${label}を保存しました` : `${label}の保存を解除しました`);
      return nextSaved;
    } catch {
      if (activeUserId.current === userId) toast.error("保存状態の更新に失敗しました");
      return !nextSaved;
    }
  }, [isLoggedIn, isSaved, mutate, openLoginModal, userId]);

  const removeSaved = useCallback(async (type: SavedItemType, id: string) => {
    if (!userId) return;
    try {
      const applied = await mutate(type, id, "DELETE", userId);
      if (!applied) return;
      toast.success(`${SAVED_ITEM_LABELS[type]}の保存を解除しました`);
    } catch {
      if (activeUserId.current === userId) toast.error("保存状態の更新に失敗しました");
    }
  }, [mutate, userId]);
  const value = useMemo(() => ({ savedItems, hydrated, syncing, error, isSaved, toggleSaved, removeSaved, refreshSavedItems }), [savedItems, hydrated, syncing, error, isSaved, toggleSaved, removeSaved, refreshSavedItems]);
  return <SavedItemsContext.Provider value={value}>{children}</SavedItemsContext.Provider>;
}

export function useSavedItems() {
  const context = useContext(SavedItemsContext);
  if (!context) throw new Error("useSavedItems must be used within a SavedItemsProvider");
  return context;
}
