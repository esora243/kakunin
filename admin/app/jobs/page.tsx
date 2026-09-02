import Link from "next/link";
import { Briefcase } from "lucide-react";
import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { listJobRows } from "@/lib/jobs";
import { listEmploymentTypes, listJobCategories, listUniversities } from "@/lib/master-data";
import { singleStringParam, stringParamFromAllowlist } from "@/lib/query-params";
import { publishStateOf, type PublishState } from "@/lib/publishing";
import { ViewOnlyBanner } from "@/components/ViewOnlyBanner";
import { AccessDenied } from "@/components/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { FilterBar, SearchInput, SelectField } from "@/components/ui/FilterBar";
import { TableShell, THead, Th, Tr, Td, TdMono } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
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

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; jobCategoryId?: string; employmentTypeId?: string; universityId?: string }>;
}) {
  const params = await searchParams;
  const q = singleStringParam(params.q);
  const jobCategoryId = singleStringParam(params.jobCategoryId);
  const employmentTypeId = singleStringParam(params.employmentTypeId);
  const universityId = singleStringParam(params.universityId);
  const identity = await getAdminIdentityForPage();
  if (!identity) return <AccessDenied />;

  const [categories, employmentTypes, universities] = await Promise.all([
    listJobCategories(),
    listEmploymentTypes(),
    listUniversities(),
  ]);
  const rows = await listJobRows({
    q,
    jobCategoryId: stringParamFromAllowlist(jobCategoryId ?? null, categories.map((category) => category.id)),
    employmentTypeId: stringParamFromAllowlist(employmentTypeId ?? null, employmentTypes.map((type) => type.id)),
    universityId: stringParamFromAllowlist(universityId ?? null, universities.map((university) => university.id)),
  });
  const hasFilters = Boolean(q || jobCategoryId || employmentTypeId || universityId);

  return (
    <div>
      <PageHeader
        eyebrow="求人"
        title="求人一覧"
        description="公開中の求人と下書きを確認できます。"
        meta={<span>{rows.length} 件</span>}
        actions={
          identity?.role === "owner" ? (
            <Link href="/jobs/new" className="inline-flex">
              <Button size="sm">新規作成</Button>
            </Link>
          ) : null
        }
      />

      {identity?.role !== "owner" ? <ViewOnlyBanner domain="求人" /> : null}

      <FilterBar clearHref={hasFilters ? "/jobs" : undefined}>
        <SearchInput name="q" defaultValue={q ?? ""} label="キーワード" placeholder="タイトル・会社名で検索" />
        <SelectField
          name="jobCategoryId"
          defaultValue={jobCategoryId ?? ""}
          label="職種カテゴリ"
          options={[
            { value: "", label: "すべて" },
            ...categories.map((category) => ({ value: category.id, label: category.name })),
          ]}
        />
        <SelectField
          name="employmentTypeId"
          defaultValue={employmentTypeId ?? ""}
          label="雇用形態"
          options={[
            { value: "", label: "すべて" },
            ...employmentTypes.map((type) => ({ value: type.id, label: type.name })),
          ]}
        />
        <SelectField
          name="universityId"
          defaultValue={universityId ?? ""}
          label="大学"
          options={[
            { value: "", label: "すべて" },
            ...universities.map((university) => ({ value: university.id, label: university.name })),
          ]}
        />
      </FilterBar>

      {rows.length === 0 ? (
        <TableShell>
          <THead>
            <Th>タイトル</Th>
            <Th>職種カテゴリ</Th>
            <Th>雇用形態</Th>
            <Th>勤務地</Th>
            <Th>公開状態</Th>
            <Th align="right">更新日時</Th>
          </THead>
          <tbody>
            <tr>
              <td colSpan={6}>
                <EmptyState
                  icon={Briefcase}
                  title={hasFilters ? "条件に一致する求人がありません" : "求人がまだありません"}
                  description={
                    hasFilters
                      ? "検索条件を変更してください。条件をすべて解除することもできます。"
                      : identity?.role === "owner"
                        ? "「新規作成」から最初の求人を作成してください。"
                        : undefined
                  }
                  action={
                    hasFilters ? (
                      <Link href="/jobs" className="text-sm text-orange-700 underline">
                        条件をクリア
                      </Link>
                    ) : undefined
                  }
                />
              </td>
            </tr>
          </tbody>
        </TableShell>
      ) : (
        <TableShell>
          <THead>
            <Th>タイトル</Th>
            <Th>職種カテゴリ</Th>
            <Th>雇用形態</Th>
            <Th>勤務地</Th>
            <Th>公開状態</Th>
            <Th align="right">更新日時</Th>
          </THead>
          <tbody>
            {rows.map((row) => {
              const state = publishStateOf(row);
              return (
                <Tr key={row.id}>
                  <Td>
                    <Link
                      href={`/jobs/${row.id}`}
                      className="font-semibold text-stone-900 underline decoration-stone-300 hover:text-orange-700 hover:decoration-orange-500"
                    >
                      {row.title}
                    </Link>
                  </Td>
                  <Td>{row.job_category_name}</Td>
                  <Td>{row.employment_type_name}</Td>
                  <Td>{row.location_pref ?? "-"}</Td>
                  <Td>
                    <StatusBadge variant={STATE_BADGE_VARIANT[state]}>{STATE_LABEL[state]}</StatusBadge>
                  </Td>
                  <TdMono align="right">{formatDateTime(row.updated_at)}</TdMono>
                </Tr>
              );
            })}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}
