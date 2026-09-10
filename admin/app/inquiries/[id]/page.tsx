import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { AccessDenied } from "@/components/AccessDenied";
import { loadInquiryDetailForOwner } from "@/lib/inquiries";
import { StatusUpdateForm } from "./StatusUpdateForm";
import { pageUuidParam } from "@/lib/query-params";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/StatusBadge";
import { buttonClasses } from "@/components/ui/Button";

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

const RELATED_TYPE_LABELS: Record<string, string> = {
  job: "求人",
  activity: "活動",
  content: "コンテンツ",
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function InquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const identity = await getAdminIdentityForPage();
  if (!identity) return <AccessDenied />;

  // Server-side gate: editors must never receive inquiry detail data at
  // all, even via direct URL navigation, per docs/admin-management-app-spec.md
  // "Inquiries" > "Launch permissions". No inquiry fetch happens above
  // this check.
  if (identity.role !== "owner") {
    return (
      <main className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <h1 className="text-lg font-semibold text-stone-900">アクセスできません</h1>
        <p className="max-w-md text-sm text-stone-500">
          お問い合わせの本文と連絡先は管理責任者のみ確認できます。
        </p>
        <Link
          href="/inquiries"
          className="text-sm text-stone-900 underline decoration-stone-300 hover:text-orange-700 hover:decoration-orange-500"
        >
          一覧に戻る
        </Link>
      </main>
    );
  }

  const routeParams = await params;
  const id = pageUuidParam(routeParams.id);
  if (!id) notFound();
  // loadInquiryDetailForOwner both fetches the full row and writes the
  // mandatory "Owner inquiry detail reads should be audit logged" entry, so
  // this page and the API route share one implementation of that side
  // effect instead of duplicating it.
  const inquiry = await loadInquiryDetailForOwner(identity.adminId, id);

  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="お問い合わせ"
        title="お問い合わせ詳細"
        actions={
          <Link href="/inquiries" className={buttonClasses("secondary", "sm")}>
            一覧に戻る
          </Link>
        }
      />

      <Card title="メタ情報">
        <DescriptionList
          items={[
            { label: "受信日時", value: formatDateTime(inquiry.created_at), mono: true },
            { label: "種別", value: INTENT_LABELS[inquiry.intent] ?? inquiry.intent },
            {
              label: "状態",
              value: (
                <StatusBadge variant={STATUS_BADGE_VARIANT[inquiry.status] ?? "neutral"}>
                  {STATUS_LABELS[inquiry.status] ?? inquiry.status}
                </StatusBadge>
              ),
            },
            {
              label: "関連リソース",
              value: `${inquiry.related_title ?? "—"}${
                inquiry.related_type ? ` (${RELATED_TYPE_LABELS[inquiry.related_type] ?? inquiry.related_type})` : ""
              }`,
            },
          ]}
        />
      </Card>

      <div className="mt-6">
        <Card title="本文">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-900">{inquiry.message}</p>
        </Card>
      </div>

      <div className="mt-6">
        <Card title="状態を変更">
          <StatusUpdateForm inquiryId={inquiry.id} currentStatus={inquiry.status} />
        </Card>
      </div>
    </div>
  );
}
