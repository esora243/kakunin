"use client";

import { CalendarPlus, Pencil, Trash2, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { readRequiredApiJson } from "@/lib/api-client";
import type { SharedTimetableDay, SharedTimetableEntry } from "@/lib/shared-timetable";

type SharedTimetableTabProps = {
  authHydrated: boolean;
  isLoggedIn: boolean;
  onLogin: () => void;
};

const DAYS: SharedTimetableDay[] = ["月", "火", "水", "木", "金", "土"];
const DAY_ORDER: Record<SharedTimetableDay, number> = { 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6 };
const TERM_OPTIONS = ["1", "2", "3", "4"];
const PERIOD_OPTIONS = ["1", "2", "3", "4", "5", "6", "7"];

type UniversityOption = { id: string; name: string };

type FormState = {
  universityId: string;
  academicYear: string;
  termNumber: string;
  dayOfWeek: SharedTimetableDay;
  period: string;
  classTitle: string;
  instructor: string;
  room: string;
  note: string;
};

const DEFAULT_FORM: FormState = {
  universityId: "",
  academicYear: String(new Date().getFullYear()),
  termNumber: "1",
  dayOfWeek: "月",
  period: "1",
  classTitle: "",
  instructor: "",
  room: "",
  note: "",
};

const inputClasses =
  "w-full rounded-control border border-subtle bg-surface-card px-3 py-2 text-body text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";

export function SharedTimetableTab({ authHydrated, isLoggedIn, onLogin }: SharedTimetableTabProps) {
  const [entries, setEntries] = useState<SharedTimetableEntry[] | null>(null);
  const [universities, setUniversities] = useState<UniversityOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/shared-timetable", { cache: "no-store" });
      const data = await readRequiredApiJson<{ ok: true; entries: SharedTimetableEntry[] }>(
        response,
        "共有時間割の取得に失敗しました",
      );
      setEntries(data.entries);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "共有時間割の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/profile/options", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        const options = data?.item?.universities;
        if (Array.isArray(options)) setUniversities(options);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedEntries = useMemo(() => {
    if (!entries) return [];
    return [...entries].sort(
      (a, b) =>
        DAY_ORDER[a.dayOfWeek] - DAY_ORDER[b.dayOfWeek] ||
        a.period - b.period ||
        a.createdAt.localeCompare(b.createdAt),
    );
  }, [entries]);

  function resetForm() {
    setForm({ ...DEFAULT_FORM, universityId: universities[0]?.id ?? "" });
    setEditingId(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        universityId: form.universityId,
        academicYear: Number(form.academicYear),
        termNumber: Number(form.termNumber),
        dayOfWeek: form.dayOfWeek,
        period: Number(form.period),
        classTitle: form.classTitle.trim(),
        instructor: form.instructor.trim() || null,
        room: form.room.trim() || null,
        note: form.note.trim() || null,
      };
      const response = await fetch(
        editingId ? `/api/shared-timetable/${editingId}` : "/api/shared-timetable",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      await readRequiredApiJson(response, editingId ? "共有時間割の更新に失敗しました" : "共有時間割への追加に失敗しました");
      toast.success(editingId ? "共有時間割を更新しました" : "共有時間割に追加しました");
      resetForm();
      setShowForm(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "共有時間割の保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(entry: SharedTimetableEntry) {
    setEditingId(entry.id);
    setForm({
      universityId: entry.universityId,
      academicYear: String(entry.academicYear),
      termNumber: String(entry.termNumber),
      dayOfWeek: entry.dayOfWeek,
      period: String(entry.period),
      classTitle: entry.classTitle,
      instructor: entry.instructor ?? "",
      room: entry.room ?? "",
      note: entry.note ?? "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(entry: SharedTimetableEntry) {
    if (!confirm(`${entry.dayOfWeek}${entry.period}限 ${entry.classTitle} を削除します。よろしいですか？`)) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/shared-timetable/${entry.id}`, { method: "DELETE" });
      await readRequiredApiJson(response, "共有時間割の削除に失敗しました");
      toast.success("共有時間割から削除しました");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "共有時間割の削除に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  const canEdit = authHydrated && isLoggedIn;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-body text-secondary">
          みんなで作る共有時間割です。ログインすると誰でも授業を追加・編集できます。
        </p>
        {canEdit ? (
          <Button
            size="sm"
            variant={showForm ? "secondary" : "primary"}
            onClick={() => {
              if (!showForm) resetForm();
              setShowForm((value) => !value);
            }}
          >
            <CalendarPlus size={16} aria-hidden="true" />
            {showForm ? "閉じる" : "授業を追加"}
          </Button>
        ) : (
          <Button size="sm" variant="line" onClick={onLogin}>
            ログインして追加
          </Button>
        )}
      </div>

      {showForm ? (
        <Card className="p-5">
          <h3 className="text-body font-bold text-primary">{editingId ? "授業を編集" : "授業を追加"}</h3>
          <p className="mt-1 text-meta text-secondary">大学・曜限・科目名などを入力します</p>
          <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-meta font-bold text-primary">大学</span>
              <select
                className={inputClasses}
                value={form.universityId}
                onChange={(event) => setForm((previous) => ({ ...previous, universityId: event.target.value }))}
                required
              >
                <option value="">選択してください</option>
                {universities.map((university) => (
                  <option key={university.id} value={university.id}>{university.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-meta font-bold text-primary">科目名</span>
              <input
                className={inputClasses}
                value={form.classTitle}
                onChange={(event) => setForm((previous) => ({ ...previous, classTitle: event.target.value }))}
                placeholder="例: 解剖学実習"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-meta font-bold text-primary">年度</span>
              <input
                className={inputClasses}
                type="number"
                min={2000}
                max={2100}
                value={form.academicYear}
                onChange={(event) => setForm((previous) => ({ ...previous, academicYear: event.target.value }))}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-meta font-bold text-primary">学期</span>
              <select
                className={inputClasses}
                value={form.termNumber}
                onChange={(event) => setForm((previous) => ({ ...previous, termNumber: event.target.value }))}
              >
                {TERM_OPTIONS.map((term) => (
                  <option key={term} value={term}>{term}学期</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-meta font-bold text-primary">曜日</span>
              <select
                className={inputClasses}
                value={form.dayOfWeek}
                onChange={(event) => setForm((previous) => ({ ...previous, dayOfWeek: event.target.value as SharedTimetableDay }))}
              >
                {DAYS.map((day) => (
                  <option key={day} value={day}>{day}曜日</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-meta font-bold text-primary">時限</span>
              <select
                className={inputClasses}
                value={form.period}
                onChange={(event) => setForm((previous) => ({ ...previous, period: event.target.value }))}
              >
                {PERIOD_OPTIONS.map((period) => (
                  <option key={period} value={period}>{period}限</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-meta font-bold text-primary">担当教員</span>
              <input
                className={inputClasses}
                value={form.instructor}
                onChange={(event) => setForm((previous) => ({ ...previous, instructor: event.target.value }))}
                placeholder="任意"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-meta font-bold text-primary">教室</span>
              <input
                className={inputClasses}
                value={form.room}
                onChange={(event) => setForm((previous) => ({ ...previous, room: event.target.value }))}
                placeholder="任意"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-meta font-bold text-primary">備考</span>
              <input
                className={inputClasses}
                value={form.note}
                onChange={(event) => setForm((previous) => ({ ...previous, note: event.target.value }))}
                placeholder="任意"
              />
            </label>
            <div className="flex justify-end gap-2 sm:col-span-2">
              {editingId ? (
                <Button type="button" variant="ghost" onClick={resetForm}>キャンセル</Button>
              ) : null}
              <Button type="submit" disabled={saving}>
                {saving ? "保存中..." : editingId ? "更新する" : "追加する"}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {loading ? (
        <LoadingState label="共有時間割を読み込んでいます" />
      ) : error ? (
        <ErrorState title="共有時間割を取得できませんでした" description="通信状態を確認して、もう一度お試しください。" detail={error} icon={Users} />
      ) : !sortedEntries.length ? (
        <EmptyState
          icon={Users}
          title="共有時間割はまだ空です"
          description={canEdit ? "「授業を追加」から最初の授業を追加できます。" : "ログインすると授業を追加できます。"}
          action={canEdit ? <Button onClick={() => { resetForm(); setShowForm(true); }}>授業を追加</Button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {sortedEntries.map((entry) => (
            <Card key={entry.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-flex shrink-0 rounded-pill bg-brand-50 px-2 py-1 text-micro font-bold text-brand-600">
                    {entry.dayOfWeek}{entry.period}限
                  </span>
                  <h3 className="mt-2 text-body font-bold leading-snug text-primary">{entry.classTitle}</h3>
                  <p className="mt-1 text-meta text-secondary">
                    {entry.universityName}・{entry.academicYear}年度 {entry.termNumber}学期
                  </p>
                  <p className="mt-1 text-meta text-tertiary">
                    {[entry.instructor, entry.room].filter(Boolean).join(" / ") || "教員・教室未設定"}
                    {entry.note ? `・${entry.note}` : ""}
                  </p>
                </div>
                {canEdit ? (
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="secondary" onClick={() => startEdit(entry)} disabled={saving}>
                      <Pencil size={14} aria-hidden="true" />
                      編集
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => void handleDelete(entry)} disabled={saving}>
                      <Trash2 size={14} aria-hidden="true" />
                      削除
                    </Button>
                  </div>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
