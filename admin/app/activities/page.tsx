import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { listActivityRows } from "@/lib/activities";
import { publishStateOf, type PublishState } from "@/lib/publishing";
import { ViewOnlyBanner } from "@/components/ViewOnlyBanner";
import { AccessDenied } from "@/components/AccessDenied";
import { singleStringParam } from "@/lib/query-params";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { FilterBar, SearchInput } from "@/components/ui/FilterBar";
import { TableShell, THead, Th, Tr, Td, TdMono } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/StatusBadge";
import { activityActionLabel } from "@/lib/operator-labels";

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

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const q = singleStringParam(params.q);
  const identity = await getAdminIdentityForPage();
  if (!identity) return <AccessDenied />;

  const rows = await listActivityRows({ q });
  const hasFilters = Boolean(q);

  return (
    <div>
      <PageHeader
        eyebrow="課外活動"
        title="課外活動一覧"
        description="参加や応募を受け付ける課外活動を確認できます。"
        meta={<span>{rows.length} 件</span>}
        actions={
          identity?.role === "owner" ? (
            <Link href="/activities/new" className="inline-flex">
              <Button size="sm">新規作成</Button>
            </Link>
          ) : null
        }
      />

      {identity?.role !== "owner" ? <ViewOnlyBanner domain="課外活動" /> : null}

      <FilterBar clearHref={hasFilters ? "/activities" : undefined}>
        <SearchInput name="q" defaultValue={q ?? ""} label="キーワード" placeholder="タイトル・主催者名で検索" />
      </FilterBar>

      {rows.length === 0 ? (
        <TableShell>
          <THead>
            <Th>タイトル</Th>
            <Th>種別</Th>
            <Th>主催者</Th>
            <Th>利用者の操作</Th>
            <Th>締切</Th>
            <Th>公開状態</Th>
            <Th align="right">更新日時</Th>
          </THead>
          <tbody>
            <tr>
              <td colSpan={7}>
                <EmptyState
                  icon={CalendarDays}
                  title={hasFilters ? "条件に一致する課外活動がありません" : "課外活動がまだありません"}
                  description={
                    hasFilters
                      ? "検索条件を変更してください。条件をすべて解除することもできます。"
                      : identity?.role === "owner"
                        ? "「新規作成」から最初の課外活動を作成してください。"
                        : undefined
                  }
                  action={
                    hasFilters ? (
                      <Link href="/activities" className="text-sm text-orange-700 underline">
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
            <Th>種別</Th>
            <Th>主催者</Th>
            <Th>利用者の操作</Th>
            <Th>締切</Th>
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
                      href={`/activities/${row.id}`}
                      className="font-semibold text-stone-900 underline decoration-stone-300 hover:text-orange-700 hover:decoration-orange-500"
                    >
                      {row.title}
                    </Link>
                  </Td>
                  <Td>{row.kind_name}</Td>
                  <Td>{row.host_name}</Td>
                  <Td>{activityActionLabel(row.action_type)}</Td>
                  <TdMono>{formatDateTime(row.deadline_at)}</TdMono>
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
