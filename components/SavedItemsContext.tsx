"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SavedEntry, SavedItemType } from "@/lib/types";

const STORAGE_KEY = "hugmeid_saved_items";

/**
 * SavedItemsContext
 * - "job" / "campaign" / "article" の3種類のお気に入りを横断管理する。
 * - 記事 (article) は lib/articles.ts (articles.json) と id を文字列で揃えるため、
 *   常に String(id) で正規化して保存・比較する。
 */
type SavedItemsContextType = {
  savedItems: SavedEntry[];
  hydrated: boolean;
  isSaved: (type: SavedItemType, id: string | number) => boolean;
  toggleSaved: (type: SavedItemType, id: string | number) => boolean;
  removeSaved: (type: SavedItemType, id: string | number) => void;
  /** 指定タイプに絞ったお気に入りID配列を返すヘルパ */
  getSavedIds: (type: SavedItemType) => string[];
};

const SavedItemsContext = createContext<SavedItemsContextType | undefined>(undefined);

export function SavedItemsProvider({ children }: { children: ReactNode }) {
  const [savedItems, setSavedItems] = useState<SavedEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedEntry[];
        // 過去フォーマットの不整合（type 欠落・id が number 等）を念のため正規化
        const normalized = Array.isArray(parsed)
          ? parsed
              .filter((e) => e && (e.type === "job" || e.type === "campaign" || e.type === "article"))
              .map((e) => ({ type: e.type, id: String(e.id), savedAt: e.savedAt ?? new Date().toISOString() }))
          : [];
        setSavedItems(normalized);
      }
    } catch {
      setSavedItems([]);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedItems));
  }, [hydrated, savedItems]);

  const isSaved = useCallback(
    (type: SavedItemType, id: string | number) =>
      savedItems.some((item) => item.type === type && item.id === String(id)),
    [savedItems],
  );

  const toggleSaved = useCallback((type: SavedItemType, id: string | number) => {
    const normalizedId = String(id);
    let nextSaved = false;

    setSavedItems((current) => {
      const exists = current.some((item) => item.type === type && item.id === normalizedId);
      nextSaved = !exists;

      if (exists) {
        return current.filter((item) => !(item.type === type && item.id === normalizedId));
      }

      return [{ type, id: normalizedId, savedAt: new Date().toISOString() }, ...current];
    });

    return nextSaved;
  }, []);

  const removeSaved = useCallback((type: SavedItemType, id: string | number) => {
    const normalizedId = String(id);
    setSavedItems((current) =>
      current.filter((item) => !(item.type === type && item.id === normalizedId)),
    );
  }, []);

  const getSavedIds = useCallback(
    (type: SavedItemType) => savedItems.filter((s) => s.type === type).map((s) => s.id),
    [savedItems],
  );

  const value = useMemo(
    () => ({ savedItems, hydrated, isSaved, toggleSaved, removeSaved, getSavedIds }),
    [savedItems, hydrated, isSaved, toggleSaved, removeSaved, getSavedIds],
  );

  return <SavedItemsContext.Provider value={value}>{children}</SavedItemsContext.Provider>;
}

export function useSavedItems() {
  const context = useContext(SavedItemsContext);
  if (!context) {
    throw new Error("useSavedItems must be used within a SavedItemsProvider");
  }
  return context;
}
