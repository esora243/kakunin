"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthContext";

type BookmarkApiItem = {
  job_id: string;
  jobs?: {
    id: string;
    title: string;
    company_name: string;
    location_type: string;
    salary: string | null;
    salary_display?: string | null;
  } | null;
  created_at: string;
};

export function useJobBookmarks() {
  const { token, isLoggedIn } = useAuth();
  const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkApiItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) {
      setSavedJobIds([]);
      setBookmarks([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/bookmarks", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { bookmarks: BookmarkApiItem[] };
      setBookmarks(data.bookmarks || []);
      setSavedJobIds((data.bookmarks || []).map((item) => item.job_id));
    } catch {
      toast.error("保存済み求人の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isSaved = useCallback((jobId: string | number) => savedJobIds.includes(String(jobId)), [savedJobIds]);

  const toggle = useCallback(
    async (jobId: string | number) => {
      if (!token || !isLoggedIn) return false;

      const normalizedId = String(jobId);
      const alreadySaved = savedJobIds.includes(normalizedId);

      setSavedJobIds((current) =>
        alreadySaved ? current.filter((id) => id !== normalizedId) : [normalizedId, ...current],
      );

      try {
        const res = await fetch("/api/bookmarks", {
          method: alreadySaved ? "DELETE" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ jobId: normalizedId }),
        });

        if (!res.ok) throw new Error("failed");
        await refresh();
        return !alreadySaved;
      } catch {
        await refresh();
        toast.error(alreadySaved ? "保存解除に失敗しました" : "保存に失敗しました");
        return alreadySaved;
      }
    },
    [isLoggedIn, refresh, savedJobIds, token],
  );

  return useMemo(
    () => ({ isSaved, toggle, bookmarks, loading, refresh }),
    [isSaved, toggle, bookmarks, loading, refresh],
  );
}
