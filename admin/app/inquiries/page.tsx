import Link from "next/link";
import { Inbox } from "lucide-react";
import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { AccessDenied } from "@/components/AccessDenied";
import { listInquiryMetadataRows } from "@/lib/inquiries";
import { singleStringParam } from "@/lib/query-params";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, SelectField } from "@/components/ui/FilterBar";
import { TableShell, THead, Th, Tr, Td, TdMono } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/StatusBadge";
import { Banner } from "@/components/ui/Banner";

export const dynamic = "force-dynamic";

const INTENT_LABELS: Record<string, string> = {
  job: "求人",
  activity: "活動",
  content: "コンテンツ",
  school_career: "学校・キャリア",
  sponsor_partner: "スポンサー・提携",
  problem_report: "問題報告",
  other: "その他",
};

const STATUS_LABELS: Record<string, string> = {
  open: "未対応",
  in_progress: "対応中",
  closed: "完了",
};

const STATUS_BADGE_VARIANT: Record<string, StatusBadgeVariant> = {
  open: "warning",
  in_progress: "info",
  closed: "neutral",
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function InquiriesListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; intent?: string; relatedType?: string }>;
}) {
  const params = await searchParams;
  const status = singleStringParam(params.status);
  const intent = singleStringParam(params.intent);
  const relatedType = singleStringParam(params.relatedType);
  const identity = await getAdminIdentityForPage();
  if (!identity) return <AccessDenied />;
  const rows = await listInquiryMetadataRows({
    status: (["open", "in_progress", "closed"].includes(status ?? "") ? (status as "open" | "in_progress" | "closed") : undefined),
    intent: (
      ["job", "activity", "content", "school_career", "sponsor_partner", "problem_report", "other"].includes(intent ?? "")
        ? (intent as "job" | "activity" | "content" | "school_career" | "sponsor_partner" | "problem_report" | "other")
        : undefined
    ),
    relatedType: (["job", "activity", "content"].includes(relatedType ?? "") ? (relatedType as "job" | "activity" | "content") : undefined),
  });
  const isOwner = identity.role === "owner";
  const hasFilters = Boolean(status || intent || relatedType);

  // Safe for both roles: listInquiryMetadataRows never selects message
  // body, contact fields, or user_id at all, per
  // docs/admin-management-app-spec.md "Inquiries" > "Launch permissions".

  return (
    <div>
      <PageHeader
        eyebrow="運用"
        title="お問い合わせ"
        description="利用者から届いたお問い合わせを対応順に確認できます。"
        meta={<span>{rows.length} 件</span>}
      />
      {!isOwner ? (
        <div className="mb-4">
          <Banner variant="info">
            編集メンバーには受付日時と種別だけ表示されます。本文と連絡先は管理責任者のみ確認できます。
          </Banner>
        </div>
      ) : null}

      <FilterBar clearHref={hasFilters ? "/inquiries" : undefined}>
        <SelectField
          name="relatedType"
          defaultValue={relatedType ?? ""}
          label="関連種別"
          options={[
            { value: "", label: "すべて" },
            { value: "job", label: "求人" },
            { value: "activity", label: "活動" },
            { value: "content", label: "コンテンツ" },
          ]}
        />
        <SelectField
          name="intent"
          defaultValue={intent ?? ""}
          label="種別"
          options={[
            { value: "", label: "すべて" },
            { value: "job", label: "求人" },
            { value: "activity", label: "活動" },
            { value: "content", label: "コンテンツ" },
            { value: "school_career", label: "学校・キャリア" },
            { value: "sponsor_partner", label: "スポンサー・提携" },
            { value: "problem_report", label: "問題報告" },
            { value: "other", label: "その他" },
          ]}
        />
        <SelectField
          name="status"
          defaultValue={status ?? ""}
          label="状態"
          options={[
            { value: "", label: "すべて" },
            { value: "open", label: "未対応" },
            { value: "in_progress", label: "対応中" },
            { value: "closed", label: "完了" },
          ]}
        />
      </FilterBar>

      <TableShell>
        <THead>
          <Th>受信日時</Th>
          <Th>種別</Th>
          <Th>状態</Th>
          <Th>関連リソース</Th>
          <Th>詳細</Th>
        </THead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5}>
                <EmptyState
                  icon={Inbox}
                  title="条件に一致するお問い合わせがありません"
                  description={hasFilters ? "検索条件を変更してください。条件をすべて解除することもできます。" : "お問い合わせはまだありません。"}
                  action={
                    hasFilters ? (
                      <Link href="/inquiries" className="text-sm text-orange-700 underline">
                        条件をクリア
                      </Link>
                    ) : undefined
                  }
                />
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <Tr key={row.id}>
                <TdMono>{formatDateTime(row.created_at)}</TdMono>
                <Td>{INTENT_LABELS[row.intent] ?? row.intent}</Td>
                <Td>
                  <StatusBadge variant={STATUS_BADGE_VARIANT[row.status] ?? "neutral"}>
                    {STATUS_LABELS[row.status] ?? row.status}
                  </StatusBadge>
                </Td>
                <Td>{row.related_title ?? "—"}</Td>
                <Td>
                  {isOwner ? (
                    <Link href={`/inquiries/${row.id}`} className="font-medium text-stone-900 hover:text-orange-700">
                      詳細を見る
                    </Link>
                  ) : (
                    <span className="text-xs text-stone-400">管理責任者のみ確認できます</span>
                  )}
                </Td>
              </Tr>
            ))
          )}
        </tbody>
      </TableShell>
    </div>
  );
}
