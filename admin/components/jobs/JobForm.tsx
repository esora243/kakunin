"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { JobDetailRow } from "@/lib/jobs";
import type { EmploymentTypeRow, JobCategoryRow, UniversityRow } from "@/lib/master-data";
import { publishStateOf, type PublishState } from "@/lib/publishing";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { FormSection, FieldLabel, TextInput, TextArea, SelectInput, FieldHint } from "@/components/ui/Form";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/StatusBadge";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { isSafePublicUrl, japanLocalDateTimeToIso, operatorSlug } from "@/lib/operator-form";

const STATE_LABEL: Record<PublishState, string> = {
  draft: "ドラフト",
  review: "レビュー中",
  approved: "承認済み",
  scheduled: "予約公開",
  published: "公開中",
  deactivated: "無効化",
};

const STATE_BADGE_VARIANT: Record<PublishState, StatusBadgeVariant> = {
  draft: "neutral",
  review: "warning",
  approved: "warning",
  scheduled: "info",
  published: "success",
  deactivated: "danger",
};

const ACTION_SUCCESS_LABEL: Record<"publish" | "unpublish" | "deactivate", string> = {
  publish: "公開しました",
  unpublish: "非公開にしました",
  deactivate: "無効化しました",
};

type FormState = {
  title: string;
  jobCategoryId: string;
  employmentTypeId: string;
  universityId: string;
  companyName: string;
  companyType: string;
  locationPref: string;
  locationDetail: string;
  salaryMin: string;
  salaryDisplay: string;
  workSchedule: string;
  summary: string;
  descriptionMd: string;
  requirementsSummary: string;
  requirementsList: string;
  benefits: string;
  slug: string;
  applyUrl: string;
  externalSource: string;
  externalId: string;
  externalSlug: string;
};

function lines(value: unknown): string {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string").join("\n") : "";
}

function toFormState(job: JobDetailRow | null, categories: JobCategoryRow[], employmentTypes: EmploymentTypeRow[]): FormState {
  return {
    title: job?.title ?? "",
    jobCategoryId: job?.job_category_id ?? categories[0]?.id ?? "",
    employmentTypeId: job?.employment_type_id ?? employmentTypes[0]?.id ?? "",
    universityId: job?.university_id ?? "",
    companyName: job?.company_name ?? "",
    companyType: job?.company_type ?? "",
    locationPref: job?.location_pref ?? "",
    locationDetail: job?.location_detail ?? "",
    salaryMin: job?.salary_min == null ? "" : String(job.salary_min),
    salaryDisplay: job?.salary_display ?? "",
    workSchedule: job?.work_schedule ?? "",
    summary: job?.summary ?? "",
    descriptionMd: job?.description_md ?? "",
    requirementsSummary: job?.requirements_summary ?? "",
    requirementsList: lines(job?.requirements_list),
    benefits: lines(job?.benefits),
    slug: job?.slug ?? "",
    applyUrl: job?.apply_url ?? "",
    externalSource: job?.external_source ?? "admin",
    externalId: job?.external_id ?? "",
    externalSlug: job?.external_slug ?? "",
  };
}

function universityOptions(job: JobDetailRow | null, universities: UniversityRow[]) {
  if (job?.university_id && !universities.some((university) => university.id === job.university_id) && job.university_name) {
    return [{ id: job.university_id, name: `${job.university_name} (inactive)` } as UniversityRow, ...universities];
  }
  return universities;
}

function toBody(form: FormState) {
  return {
    title: form.title,
    jobCategoryId: form.jobCategoryId,
    employmentTypeId: form.employmentTypeId,
    universityId: form.universityId || null,
    companyName: form.companyName || null,
    companyType: form.companyType || null,
    locationPref: form.locationPref || null,
    locationDetail: form.locationDetail || null,
    salaryMin: form.salaryMin === "" ? null : Number(form.salaryMin),
    salaryDisplay: form.salaryDisplay || null,
    workSchedule: form.workSchedule || null,
    summary: form.summary || null,
    descriptionMd: form.descriptionMd || null,
    requirementsSummary: form.requirementsSummary || null,
    requirementsList: form.requirementsList.split("\n"),
    benefits: form.benefits.split("\n"),
    slug: form.slug || null,
    applyUrl: form.applyUrl || null,
    externalSource: form.externalSource || null,
    externalId: form.externalId || null,
    externalSlug: form.externalSlug || null,
  };
}

async function parseError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  if (response.status === 409 && body?.error?.code === "stale_write") {
    return "別の管理者が更新しました。再読み込みしてください";
  }
  return body?.error?.message ?? fallback;
}

export function JobForm({
  mode,
  initialJob,
  categories,
  employmentTypes,
  universities,
}: {
  mode: "create" | "edit";
  initialJob: JobDetailRow | null;
  categories: JobCategoryRow[];
  employmentTypes: EmploymentTypeRow[];
  universities: UniversityRow[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [job, setJob] = useState(initialJob);
  const [form, setForm] = useState(() => toFormState(initialJob, categories, employmentTypes));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const saveInFlightRef = useRef(false);
  const state = job ? publishStateOf(job) : "draft";
  const isPublished = state === "published";
  const isScheduled = state === "scheduled";
  const universityList = universityOptions(job, universities);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (key === "slug") setSlugEdited(true);
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "title" && mode === "create" && !slugEdited) next.slug = operatorSlug(String(value));
      return next;
    });
  }

  async function save() {
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setSaving(true);
    setError(null);
    setWarning(null);
    try {
      const response =
        mode === "create"
          ? await fetch("/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(toBody(form)) })
          : await fetch(`/api/jobs/${job?.id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ ...toBody(form), expectedUpdatedAt: job?.updated_at }),
            });
      if (!response.ok) {
        setError(await parseError(response, "Save failed"));
        return;
      }
      const result = (await response.json()) as { job: JobDetailRow; cacheWarning?: boolean };
      setJob(result.job);
      setForm(toFormState(result.job, categories, employmentTypes));
      if (result.cacheWarning) {
        setWarning("保存しました。公開サイトへの反映に失敗しました。管理責任者が運営ホームから再試行できます。");
      } else {
        toast.success("保存しました");
      }
      if (mode === "create") router.push(`/jobs/${result.job.id}`);
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }

  async function action(actionName: "publish" | "unpublish" | "deactivate") {
    if (!job) return;
    if (actionName === "deactivate") {
      const ok = await confirm({
        title: "求人を無効化しますか？",
        description: "無効化すると公開画面に表示されなくなります。",
        confirmLabel: "無効化する",
        danger: true,
      });
      if (!ok) return;
    }
    setSaving(true);
    setError(null);
    setWarning(null);
    try {
      const response = await fetch(`/api/jobs/${job.id}/${actionName}`, {
        method: "POST",
        headers: actionName === "publish" ? { "content-type": "application/json" } : undefined,
        body: actionName === "publish" ? JSON.stringify({ scheduledAt: scheduledAt ? japanLocalDateTimeToIso(scheduledAt) : null }) : undefined,
      });
      if (!response.ok) {
        setError(await parseError(response, `${actionName} failed`));
        return;
      }
      const result = (await response.json()) as { job: JobDetailRow; cacheWarning?: boolean };
      setJob(result.job);
      setForm(toFormState(result.job, categories, employmentTypes));
      if (result.cacheWarning) {
        setWarning("操作は完了しました。公開サイトへの反映に失敗しました。管理責任者が運営ホームから再試行できます。");
      } else {
        toast.success(actionName === "publish" && scheduledAt ? "公開を予約しました" : ACTION_SUCCESS_LABEL[actionName]);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="求人" title={mode === "create" ? "求人を新規作成" : "求人を編集"} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-stone-700">状態</span>
          <StatusBadge variant={STATE_BADGE_VARIANT[state]}>{STATE_LABEL[state]}</StatusBadge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
            保存する
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mb-4">
          <Banner variant="error" title="保存に失敗しました">
            {error}
          </Banner>
        </div>
      ) : null}
      {warning ? (
        <div className="mb-4">
          <Banner variant="warning">{warning}</Banner>
        </div>
      ) : null}

      <Card padding="none">
        <div className="px-6 py-6">
          <FormSection title="基本情報" description="求人タイトルと分類">
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="job-title" required>
                タイトル
              </FieldLabel>
              <TextInput id="job-title" value={form.title} onChange={(event) => update("title", event.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor="job-category" required>
                職種カテゴリ
              </FieldLabel>
              <SelectInput
                id="job-category"
                value={form.jobCategoryId}
                onChange={(event) => update("jobCategoryId", event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </SelectInput>
            </div>
            <div>
              <FieldLabel htmlFor="job-employment-type" required>
                雇用形態
              </FieldLabel>
              <SelectInput
                id="job-employment-type"
                value={form.employmentTypeId}
                onChange={(event) => update("employmentTypeId", event.target.value)}
              >
                {employmentTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </SelectInput>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="job-university">大学</FieldLabel>
              <SelectInput
                id="job-university"
                value={form.universityId}
                onChange={(event) => update("universityId", event.target.value)}
              >
                <option value="">指定なし（大学に紐付けない）</option>
                {universityList.map((university) => (
                  <option key={university.id} value={university.id}>
                    {university.name}
                  </option>
                ))}
              </SelectInput>
            </div>
          </FormSection>

          <FormSection title="企業・勤務条件" description="会社情報と勤務条件">
            <div>
              <FieldLabel htmlFor="job-company-name">会社名</FieldLabel>
              <TextInput id="job-company-name" value={form.companyName} onChange={(event) => update("companyName", event.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor="job-company-type">会社区分</FieldLabel>
              <TextInput id="job-company-type" value={form.companyType} onChange={(event) => update("companyType", event.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor="job-location-pref">勤務地（都道府県）</FieldLabel>
              <TextInput id="job-location-pref" value={form.locationPref} onChange={(event) => update("locationPref", event.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor="job-location-detail">勤務地（詳細）</FieldLabel>
              <TextInput
                id="job-location-detail"
                value={form.locationDetail}
                onChange={(event) => update("locationDetail", event.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="job-salary-min">給与下限</FieldLabel>
              <TextInput
                id="job-salary-min"
                type="number"
                value={form.salaryMin}
                onChange={(event) => update("salaryMin", event.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="job-salary-display">給与表示</FieldLabel>
              <TextInput
                id="job-salary-display"
                value={form.salaryDisplay}
                onChange={(event) => update("salaryDisplay", event.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="job-work-schedule">勤務形態</FieldLabel>
              <TextInput
                id="job-work-schedule"
                value={form.workSchedule}
                onChange={(event) => update("workSchedule", event.target.value)}
              />
            </div>
          </FormSection>

          <FormSection title="募集内容" description="求人票の本文">
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="job-summary">概要</FieldLabel>
              <TextInput id="job-summary" value={form.summary} onChange={(event) => update("summary", event.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="job-description">詳細説明</FieldLabel>
              <TextArea
                id="job-description"
                rows={8}
                value={form.descriptionMd}
                onChange={(event) => update("descriptionMd", event.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="job-requirements-summary">応募要件（要約）</FieldLabel>
              <TextInput
                id="job-requirements-summary"
                value={form.requirementsSummary}
                onChange={(event) => update("requirementsSummary", event.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="job-requirements-list">応募要件（一覧）</FieldLabel>
              <TextArea
                id="job-requirements-list"
                rows={5}
                value={form.requirementsList}
                onChange={(event) => update("requirementsList", event.target.value)}
              />
              <FieldHint>1行に1件ずつ入力してください。</FieldHint>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="job-benefits">福利厚生</FieldLabel>
              <TextArea id="job-benefits" rows={5} value={form.benefits} onChange={(event) => update("benefits", event.target.value)} />
              <FieldHint>1行に1件ずつ入力してください。</FieldHint>
            </div>
          </FormSection>

          <FormSection title="応募方法" description="利用者が応募するときに開くページを設定します">
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="job-apply-url" required>応募先ページ</FieldLabel>
              <TextInput id="job-apply-url" type="url" placeholder="https://example.com/apply" value={form.applyUrl} onChange={(event) => update("applyUrl", event.target.value)} />
              <FieldHint>{!form.applyUrl || isSafePublicUrl(form.applyUrl) ? "応募フォームまたは募集要項ページのURLを入力してください。" : "https:// から始まる正しいURLを入力してください。"}</FieldHint>
            </div>
          </FormSection>

          <details className="border-b border-stone-200 py-6">
            <summary className="cursor-pointer text-sm font-medium text-stone-600">詳細設定（通常は変更不要）</summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="job-slug">公開ページ識別子</FieldLabel>
              <TextInput id="job-slug" value={form.slug} onChange={(event) => update("slug", event.target.value)} />
              <FieldHint>タイトルから自動作成されます。既存URLを維持する必要がある場合のみ変更してください。</FieldHint>
            </div>
            </div>
          </details>
        </div>
      </Card>

      {job ? (
        <div className="mt-6">
          <Card title="公開操作" description="公開日時の予約・公開の停止を行います。">
            <div className="flex flex-wrap items-center gap-3">
              {!isPublished ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="rounded-md border border-stone-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40" aria-label="公開日時" />
                  <Button type="button" onClick={() => void action("publish")} disabled={saving}>{scheduledAt ? "公開を予約" : "今すぐ公開"}</Button>
                </div>
              ) : null}
              {isPublished || isScheduled ? (
                <Button type="button" variant="secondary" onClick={() => void action("unpublish")} disabled={saving} className="border-amber-300 text-amber-700 hover:bg-amber-50">
                  {isScheduled ? "公開予約を取り消す" : "非公開にする"}
                </Button>
              ) : null}
            </div>
          </Card>
        </div>
      ) : null}

      {job ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-4">
          <p className="text-sm font-semibold text-red-800">危険な操作</p>
          <p className="mt-1 text-sm text-red-700">無効化すると公開画面に表示されなくなります。</p>
          <div className="mt-3">
            <Button type="button" variant="danger" size="sm" onClick={() => void action("deactivate")} disabled={saving}>
              無効化する
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
