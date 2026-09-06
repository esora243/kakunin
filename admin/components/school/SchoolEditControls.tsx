"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import type { SyllabusClassEntryRow, SyllabusPageDetailRow } from "@/lib/school";
import { Card } from "@/components/ui/Card";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";

async function parseError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  return body?.error?.message ?? fallback;
}

export function SyllabusPageEditControls({ page }: { page: SyllabusPageDetailRow }) {
  const [start, setStart] = useState(page.effective_start_date ?? "");
  const [end, setEnd] = useState(page.effective_end_date ?? "");
  const [isActive, setIsActive] = useState(page.is_active);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (start && end && start > end) {
      setError("開始日は終了日より前に設定してください");
      return;
    }
    setSaving(true);
    setError(null);
    setWarning(null);
    try {
      const response = await fetch(`/api/school/${page.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ effectiveStartDate: start || null, effectiveEndDate: end || null, isActive }),
      });
      if (!response.ok) {
        setError(await parseError(response, "保存に失敗しました"));
        return;
      }
      const result = (await response.json()) as { cacheWarning?: boolean };
      if (result.cacheWarning) {
        setWarning("保存しましたが、公開サイトへの反映に失敗しました。管理責任者が運営ホームから再試行できます。");
      } else {
        toast.success("保存しました");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="公開設定を変更" description="公開期間と利用状態を変更できます。">
      {error ? (
        <div className="mb-3">
          <Banner variant="error" title="保存に失敗しました">
            {error}
          </Banner>
        </div>
      ) : null}
      {warning ? (
        <div className="mb-3">
          <Banner variant="warning" title="公開サイトへの反映に失敗しました">
            {warning}
          </Banner>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-stone-700">適用開始日</span>
          <input
            type="date"
            className="w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-stone-700">適用終了日</span>
          <input
            type="date"
            className="w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
        <label className="flex items-end gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            className="rounded border-stone-300 text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          有効
        </label>
      </div>
      <div className="mt-4">
        <Button type="button" size="sm" onClick={save} disabled={saving}>
          {saving ? "保存中…" : "ページ情報を保存"}
        </Button>
      </div>
    </Card>
  );
}

export function SyllabusClassInlineEdit({ entry }: { entry: SyllabusClassEntryRow }) {
  const [title, setTitle] = useState(entry.title);
  const [instructor, setInstructor] = useState(entry.instructor ?? "");
  const [room, setRoom] = useState(entry.room ?? "");
  const [location, setLocation] = useState(entry.location ?? "");
  const [isActive, setIsActive] = useState(entry.is_active);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (entry.is_official && entry.source_type === "official") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-stone-400">
        <Lock size={12} aria-hidden="true" />
        公式ソース固定
      </span>
    );
  }

  async function save() {
    if (title.trim() === "") {
      setError("授業名を入力してください");
      return;
    }
    setSaving(true);
    setError(null);
    setWarning(null);
    try {
      const response = await fetch(`/api/school/classes/${entry.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, instructor: instructor || null, room: room || null, location: location || null, isActive }),
      });
      if (!response.ok) {
        setError(await parseError(response, "保存に失敗しました"));
        return;
      }
      const result = (await response.json()) as { cacheWarning?: boolean };
      if (result.cacheWarning) {
        setWarning("保存しましたが、公開サイトへの反映に失敗しました。管理責任者が運営ホームから再試行できます。");
      } else {
        toast.success("保存しました");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-72 space-y-2">
      <input
        className="w-full rounded-md border border-stone-300 px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        aria-label="授業名"
      />
      <div className="grid grid-cols-3 gap-2">
        <input
          className="rounded-md border border-stone-300 px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
          value={instructor}
          onChange={(event) => setInstructor(event.target.value)}
          aria-label="担当教員"
          placeholder="担当教員"
        />
        <input
          className="rounded-md border border-stone-300 px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
          value={room}
          onChange={(event) => setRoom(event.target.value)}
          aria-label="教室"
          placeholder="教室"
        />
        <input
          className="rounded-md border border-stone-300 px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          aria-label="場所"
          placeholder="場所"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-stone-600">
          <input
            type="checkbox"
            className="rounded border-stone-300 text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          有効
        </label>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-md border border-stone-300 px-2 py-1 text-xs text-stone-700 hover:bg-stone-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
        >
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
      {warning ? <p className="text-xs font-medium text-amber-700">{warning}</p> : null}
    </div>
  );
}
