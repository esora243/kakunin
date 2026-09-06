import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { getJobRowById } from "@/lib/jobs";
import { listEmploymentTypes, listJobCategories, listUniversities } from "@/lib/master-data";
import { pageUuidParam } from "@/lib/query-params";
import { publishStateOf, type PublishState } from "@/lib/publishing";
import { ViewOnlyBanner } from "@/components/ViewOnlyBanner";
import { AccessDenied } from "@/components/AccessDenied";
import { JobForm } from "@/components/jobs/JobForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

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

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length) return <>-</>;
  return (
    <ul className="list-inside list-disc space-y-0.5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const identity = await getAdminIdentityForPage();
  if (!identity) return <AccessDenied />;

  const routeParams = await params;
  const id = pageUuidParam(routeParams.id);
  if (!id) notFound();
  const job = await getJobRowById(id);
  if (!job) notFound();

  if (identity?.role === "owner") {
    const [categories, employmentTypes, universities] = await Promise.all([
      listJobCategories(),
      listEmploymentTypes(),
      listUniversities({ includeInactive: true }),
    ]);
    return <JobForm mode="edit" initialJob={job} categories={categories} employmentTypes={employmentTypes} universities={universities} />;
  }

  const state = publishStateOf(job);
  const requirementsList = asStringArray(job.requirements_list);
  const benefits = asStringArray(job.benefits);

  return (
    <div>
      <Link
        href="/jobs"
        className="text-sm text-stone-500 underline decoration-stone-300 hover:text-orange-700 hover:decoration-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
      >
        &larr; 求人一覧へ戻る
      </Link>
      <PageHeader eyebrow="求人" title={job.title} meta={<StatusBadge variant={STATE_BADGE_VARIANT[state]}>{STATE_LABEL[state]}</StatusBadge>} />
      <ViewOnlyBanner domain="求人" />

      <div className="space-y-6">
        <Card title="基本情報">
          <DescriptionList
            items={[
              { label: "職種カテゴリ", value: job.job_category_name },
              { label: "雇用形態", value: job.employment_type_name },
              { label: "大学", value: job.university_name ?? "-" },
            ]}
          />
        </Card>

        <Card title="企業・勤務条件">
          <DescriptionList
            items={[
              { label: "会社名", value: job.company_name ?? "-" },
              { label: "会社区分", value: job.company_type ?? "-" },
              { label: "勤務地（都道府県）", value: job.location_pref ?? "-" },
              { label: "勤務地（詳細）", value: job.location_detail ?? "-" },
              { label: "給与下限", value: job.salary_min ?? "-", mono: job.salary_min != null },
              { label: "給与表示", value: job.salary_display ?? "-" },
              { label: "勤務形態", value: job.work_schedule ?? "-" },
            ]}
          />
        </Card>

        <Card title="募集内容">
          <DescriptionList
            items={[
              { label: "概要", value: job.summary ?? "-" },
              {
                label: "詳細説明",
                value: (
                  <pre className="whitespace-pre-wrap font-sans text-sm text-stone-900">{job.description_md ?? "-"}</pre>
                ),
              },
              { label: "応募要件（要約）", value: job.requirements_summary ?? "-" },
              { label: "応募要件（一覧）", value: <BulletList items={requirementsList} /> },
              { label: "福利厚生", value: <BulletList items={benefits} /> },
            ]}
          />
        </Card>

        <Card title="公開設定">
          <DescriptionList
            items={[
              {
                label: "応募URL",
                value: job.apply_url ? (
                  <a
                    href={job.apply_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-stone-900 underline decoration-stone-300 hover:decoration-orange-500"
                  >
                    {job.apply_url}
                  </a>
                ) : (
                  "-"
                ),
              },
              { label: "スラッグ", value: job.slug ?? "-", mono: Boolean(job.slug) },
              { label: "公開日時", value: formatDateTime(job.published_at), mono: Boolean(job.published_at) },
            ]}
          />
        </Card>

        <Card title="外部連携">
          <DescriptionList
            items={[
              {
                label: "外部ソース",
                value: `${job.external_source} / ${job.external_id}${job.external_slug ? ` / ${job.external_slug}` : ""}`,
                mono: true,
              },
              { label: "外部更新日時", value: formatDateTime(job.source_last_modified_at), mono: true },
              { label: "同期日時", value: formatDateTime(job.synced_at), mono: true },
              { label: "作成日時", value: formatDateTime(job.created_at), mono: true },
              { label: "更新日時", value: formatDateTime(job.updated_at), mono: true },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
