"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { Card } from "@/components/ui/Card";
import { Table, type TableColumn } from "@/components/ui/Table";
import { FieldLabel, SelectInput, TextInput } from "@/components/ui/Form";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { ActiveUniversityOption } from "@/lib/school";
import type { AdminTimetableRow } from "@/lib/timetable-admin";

type FormState = {
  universityId: string;
  academicYear: string;
  termNumber: string;
  departmentLabel: string;
  classTitle: string;
  dayOfWeek: "月" | "火" | "水" | "木" | "金" | "土";
  period: string;
  room: string;
  instructor: string;
  note: string;
  sourceUrl: string;
};

const DEFAULT_FORM: FormState = {
  universityId: "",
  academicYear: String(new Date().getFullYear()),
  termNumber: "1",
  departmentLabel: "",
  classTitle: "",
  dayOfWeek: "月",
  period: "1",
  room: "",
  instructor: "",
  note: "",
  sourceUrl: "",
};

const DAY_OPTIONS = ["月", "火", "水", "木", "金", "土"] as const;
const TERM_OPTIONS = ["1", "2", "3", "4"] as const;
const PERIOD_OPTIONS = ["1", "2", "3", "4", "5", "6", "7"] as const;

async function parseError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  return body?.error?.message ?? fallback;
}

export function SchoolTimetableManager({
  initialUniversities,
  initialEntries,
}: {
  initialUniversities: ActiveUniversityOption[];
  initialEntries: AdminTimetableRow[];
}) {
  const [entries, setEntries] = useState<AdminTimetableRow[]>(initialEntries);
  const [universities] = useState<ActiveUniversityOption[]>(initialUniversities);
  const [filterUniversityId, setFilterUniversityId] = useState<string>("all");
  const [form, setForm] = useState<FormState>({ ...DEFAULT_FORM, universityId: initialUniversities[0]?.id ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlightRef = useRef(false);

  const filteredEntries = useMemo(
    () => (filterUniversityId === "all" ? entries : entries.filter((entry) => entry.universityId === filterUniversityId)),
    [entries, filterUniversityId],
  );

  const columns: TableColumn<AdminTimetableRow>[] = useMemo(
    () => [
      { header: "大学", accessor: (entry) => entry.universityName },
      { header: "年度", accessor: (entry) => `${entry.academicYear}年` },
      { header: "学期", accessor: (entry) => `学期 ${entry.termNumber}` },
      { header: "学科", accessor: (entry) => entry.departmentLabel },
      { header: "科目", accessor: (entry) => entry.classTitle },
      { header: "曜限", accessor: (entry) => `${entry.dayOfWeek}${entry.period}限` },
      { header: "教室", accessor: (entry) => entry.room ?? "-" },
      { header: "担当", accessor: (entry) => entry.instructor ?? "-" },
      {
        header: "状態",
        accessor: (entry) => <StatusBadge variant={entry.isActive ? "success" : "neutral"}>{entry.isActive ? "有効" : "無効"}</StatusBadge>,
      },
    ],
    [],
  );

  async function refresh() {
    const response = await fetch("/api/school/timetable", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { entries: AdminTimetableRow[] };
    setEntries(data.entries);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/school/timetable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          universityId: form.universityId,
          academicYear: Number(form.academicYear),
          termNumber: Number(form.termNumber),
          departmentLabel: form.departmentLabel,
          classTitle: form.classTitle,
          dayOfWeek: form.dayOfWeek,
          period: Number(form.period),
          room: form.room.trim() || null,
          instructor: form.instructor.trim() || null,
          note: form.note.trim() || null,
          sourceUrl: form.sourceUrl.trim() || null,
          isActive: true,
        }),
      });
      if (!response.ok) {
        setError(await parseError(response, "時間割を追加できませんでした"));
        return;
      }
      toast.success("時間割を追加しました");
      setForm({ ...DEFAULT_FORM, universityId: form.universityId });
      await refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      inFlightRef.current = false;
      setSaving(false);
    }
  }

  async function handleDeactivate(entry: AdminTimetableRow) {
    if (inFlightRef.current) return;
    if (!confirm(`${entry.universityName} / ${entry.classTitle} を無効化します。よろしいですか？`)) return;
    inFlightRef.current = true;
    setSaving(true);
    try {
      const response = await fetch(`/api/school/timetable/${entry.id}`, { method: "DELETE" });
      if (!response.ok) {
        setError(await parseError(response, "時間割を無効化できませんでした"));
        return;
      }
      toast.success("時間割を無効化しました");
      await refresh();
    } finally {
      inFlightRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Banner variant="error" title="保存に失敗しました">{error}</Banner>
      ) : null}

      <Card title="時間割を追加" description="大学・年度・学期・学科・科目・曜限を入力します">
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="tt-university" required>大学</FieldLabel>
            <SelectInput id="tt-university" value={form.universityId} onChange={(event) => setForm((previous) => ({ ...previous, universityId: event.target.value }))}>
              <option value="">選択してください</option>
              {universities.map((university) => (
                <option key={university.id} value={university.id}>{university.name}</option>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel htmlFor="tt-department" required>学科・課程</FieldLabel>
            <TextInput id="tt-department" value={form.departmentLabel} onChange={(event) => setForm((previous) => ({ ...previous, departmentLabel: event.target.value }))} />
          </div>
          <div>
            <FieldLabel htmlFor="tt-year" required>年度</FieldLabel>
            <TextInput id="tt-year" type="number" min={2000} max={2100} value={form.academicYear} onChange={(event) => setForm((previous) => ({ ...previous, academicYear: event.target.value }))} />
          </div>
          <div>
            <FieldLabel htmlFor="tt-term" required>学期</FieldLabel>
            <SelectInput id="tt-term" value={form.termNumber} onChange={(event) => setForm((previous) => ({ ...previous, termNumber: event.target.value }))}>
              {TERM_OPTIONS.map((term) => <option key={term} value={term}>{term}学期</option>)}
            </SelectInput>
          </div>
          <div>
            <FieldLabel htmlFor="tt-class" required>科目名</FieldLabel>
            <TextInput id="tt-class" value={form.classTitle} onChange={(event) => setForm((previous) => ({ ...previous, classTitle: event.target.value }))} />
          </div>
          <div>
            <FieldLabel htmlFor="tt-day" required>曜日</FieldLabel>
            <SelectInput id="tt-day" value={form.dayOfWeek} onChange={(event) => setForm((previous) => ({ ...previous, dayOfWeek: event.target.value as FormState["dayOfWeek"] }))}>
              {DAY_OPTIONS.map((day) => <option key={day} value={day}>{day}曜日</option>)}
            </SelectInput>
          </div>
          <div>
            <FieldLabel htmlFor="tt-period" required>時限</FieldLabel>
            <SelectInput id="tt-period" value={form.period} onChange={(event) => setForm((previous) => ({ ...previous, period: event.target.value }))}>
              {PERIOD_OPTIONS.map((period) => <option key={period} value={period}>{period}限</option>)}
            </SelectInput>
          </div>
          <div>
            <FieldLabel htmlFor="tt-room">教室</FieldLabel>
            <TextInput id="tt-room" value={form.room} onChange={(event) => setForm((previous) => ({ ...previous, room: event.target.value }))} />
          </div>
          <div>
            <FieldLabel htmlFor="tt-instructor">担当教員</FieldLabel>
            <TextInput id="tt-instructor" value={form.instructor} onChange={(event) => setForm((previous) => ({ ...previous, instructor: event.target.value }))} />
          </div>
          <div>
            <FieldLabel htmlFor="tt-source">引用元URL</FieldLabel>
            <TextInput id="tt-source" type="url" value={form.sourceUrl} onChange={(event) => setForm((previous) => ({ ...previous, sourceUrl: event.target.value }))} placeholder="https://example.edu/timetable" />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="tt-note">備考</FieldLabel>
            <TextInput id="tt-note" value={form.note} onChange={(event) => setForm((previous) => ({ ...previous, note: event.target.value }))} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={saving}>時間割を追加</Button>
          </div>
        </form>
      </Card>

      <Card title="登録済み時間割" padding="none">
        <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 px-6 py-3">
          <FieldLabel htmlFor="tt-filter">大学フィルター</FieldLabel>
          <SelectInput id="tt-filter" value={filterUniversityId} onChange={(event) => setFilterUniversityId(event.target.value)}>
            <option value="all">すべて</option>
            {universities.map((university) => (
              <option key={university.id} value={university.id}>{university.name}</option>
            ))}
          </SelectInput>
          <span className="text-meta text-stone-500">{filteredEntries.length}件</span>
        </div>
        <Table<AdminTimetableRow>
          rows={filteredEntries}
          columns={columns}
          getRowKey={(entry) => entry.id}
          emptyMessage="登録済みの時間割はまだありません"
          renderActions={(entry) => (
            <Button type="button" size="sm" variant="secondary" disabled={!entry.isActive || saving} onClick={() => void handleDeactivate(entry)}>
              無効化
            </Button>
          )}
        />
      </Card>

      <p className="text-sm text-stone-600">
        同じ大学・年度・学期・学科・科目・曜限の組合せは登録できません。変更が必要な場合は該当行を無効化してから追加してください。
      </p>

      <div>
        <a href="/school/timetable/import" className={buttonClasses("ghost", "sm")}>CSVでまとめて登録する</a>
      </div>
    </div>
  );
}
