import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { getAuditLogRowById } from "@/lib/audit-logs";
import { pageUuidParam } from "@/lib/query-params";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { buttonClasses } from "@/components/ui/Button";
import { auditActionLabel, auditResourceLabel } from "@/lib/operator-labels";
import { formatJapanDateTime } from "@/lib/date-time";

export const dynamic = "force-dynamic";

function formatSnapshot(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value, null, 2);
}

function SnapshotBlock({ title, value }: { title: string; value: unknown }) {
  const formatted = formatSnapshot(value);
  return (
    <div>
      <h2 className="mb-1 text-sm font-semibold text-stone-900">{title}</h2>
      {formatted ? (
        <pre className="max-h-96 overflow-auto rounded-md border border-stone-200 bg-white p-3 font-mono text-xs text-stone-700">
          {formatted}
        </pre>
      ) : (
        <p className="rounded-md border border-stone-200 bg-white p-3 text-xs text-stone-400">(なし)</p>
      )}
    </div>
  );
}

export default async function AuditLogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const identity = await getAdminIdentityForPage();

  if (!identity || identity.role !== "owner") {
    return (
      <div>
        <h1 className="mb-2 text-lg font-semibold text-stone-900">アクセス権がありません</h1>
        <p className="text-sm text-stone-500">
          操作履歴は管理責任者のみ確認できます。
        </p>
      </div>
    );
  }

  const routeParams = await params;
  const id = pageUuidParam(routeParams.id);
  if (!id) notFound();
  const row = await getAuditLogRowById(id);

  if (!row) {
    notFound();
  }

  return (
    <div>
      <PageHeader
        eyebrow="操作履歴"
        title={auditActionLabel(row.action)}
        description={`${formatJapanDateTime(row.created_at)} JST`}
        actions={
          <Link href="/audit-logs" className={buttonClasses("secondary", "sm")}>
            一覧へ戻る
          </Link>
        }
      />

      <Card padding="sm">
        <DescriptionList
          items={[
            { label: "日時", value: `${formatJapanDateTime(row.created_at)} JST`, mono: true },
            { label: "実行者", value: row.actor_email ?? "system" },
            { label: "操作", value: auditActionLabel(row.action) },
            { label: "対象", value: auditResourceLabel(row.resource_type) },
          ]}
        />
      </Card>

      <details className="mt-6 rounded-md border border-stone-200 bg-stone-50 p-4">
        <summary className="cursor-pointer text-sm font-medium text-stone-700">技術的な変更内容を表示</summary>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <SnapshotBlock title="変更前" value={row.before_snapshot} />
          <SnapshotBlock title="変更後" value={row.after_snapshot} />
        </div>
        <div className="mt-4">
          <SnapshotBlock title="補足情報" value={row.metadata} />
        </div>
      </details>
    </div>
  );
}
