import Link from "next/link";
import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { findAdminIdByEmail, listAuditLogRows } from "@/lib/audit-logs";
import { boundedNonNegativeIntegerParam, isoDateParam, singleStringParam } from "@/lib/query-params";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, SearchInput } from "@/components/ui/FilterBar";
import { TableShell, THead, Th, Tr, Td, TdMono } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";
import { Inbox, UserX } from "lucide-react";
import { auditActionLabel, auditResourceLabel } from "@/lib/operator-labels";
import { formatJapanDateTime } from "@/lib/date-time";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

const DATE_INPUT_CLASSES =
  "rounded-md border border-stone-300 px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40";
const DATE_LABEL_CLASSES = "text-[11px] font-medium uppercase tracking-wider text-stone-400";

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    actor?: string;
    resource_type?: string;
    action?: string;
    from?: string;
    to?: string;
    offset?: string;
  }>;
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

  const params = await searchParams;
  const actor = singleStringParam(params.actor);
  const resourceType = singleStringParam(params.resource_type);
  const action = singleStringParam(params.action);
  const from = isoDateParam(params.from, "From");
  const to = isoDateParam(params.to, "To");
  const offset = boundedNonNegativeIntegerParam(params.offset, "Offset", { min: 0, max: 5000 }) ?? 0;

  let actorAdminId: string | undefined;
  if (actor) {
    actorAdminId = isUuid(actor) ? actor : (await findAdminIdByEmail(actor)) ?? undefined;
  }

  const noMatchForActorFilter = Boolean(actor) && !actorAdminId;

  const { rows, total } = noMatchForActorFilter
    ? { rows: [], total: 0 }
    : await listAuditLogRows(
        {
          actorAdminId,
          resourceType: resourceType || undefined,
          action: action || undefined,
          from,
          to,
        },
        { limit: PAGE_SIZE, offset },
      );

  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;
  const hasFilters = Boolean(actor || resourceType || action || from || to);

  const buildOffsetHref = (nextOffset: number) => {
    const params = new URLSearchParams();
    if (actor) params.set("actor", actor);
    if (resourceType) params.set("resource_type", resourceType);
    if (action) params.set("action", action);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("offset", String(nextOffset));
    return `/audit-logs?${params.toString()}`;
  };

  return (
    <div>
      <PageHeader
        eyebrow="運営管理"
        title="操作履歴"
        description="誰がいつ何を変更したか確認できます。"
        meta={<span>{total > 0 ? `${offset + 1}-${Math.min(offset + PAGE_SIZE, total)} / ${total} 件` : "0 件"}</span>}
      />

      <FilterBar clearHref={hasFilters ? "/audit-logs" : undefined}>
        <SearchInput name="actor" defaultValue={actor ?? ""} label="実行者" placeholder="メールアドレスで検索" />
        <SearchInput name="resource_type" defaultValue={resourceType ?? ""} label="対象" placeholder="例: contents" />
        <SearchInput name="action" defaultValue={action ?? ""} label="操作" placeholder="例: content.update" />
        <label className="flex flex-col gap-1 text-sm">
          <span className={DATE_LABEL_CLASSES}>開始日</span>
          <input type="date" name="from" defaultValue={from ?? ""} className={DATE_INPUT_CLASSES} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className={DATE_LABEL_CLASSES}>終了日</span>
          <input type="date" name="to" defaultValue={to ?? ""} className={DATE_INPUT_CLASSES} />
        </label>
      </FilterBar>

      {noMatchForActorFilter ? (
        <EmptyState
          icon={UserX}
          title="実行者が見つかりません"
          description="指定したメールアドレスに一致する運営メンバーが見つかりませんでした。"
        />
      ) : rows.length === 0 ? (
        <EmptyState icon={Inbox} title="条件に一致する監査ログがありません" />
      ) : (
        <TableShell>
          <THead>
            <Th>日時</Th>
            <Th>実行者</Th>
            <Th>操作</Th>
            <Th>対象</Th>
            <Th>対象</Th>
          </THead>
          <tbody>
            {rows.map((row) => (
              <Tr key={row.id}>
                <TdMono>{formatJapanDateTime(row.created_at)} JST</TdMono>
                <Td>{row.actor_email ?? "system"}</Td>
                <Td>
                  <span className="inline-flex items-center rounded-md border border-stone-200 bg-stone-100 px-2 py-0.5 text-[11px] text-stone-700" title={row.action}>
                    {auditActionLabel(row.action)}
                  </span>
                </Td>
                <Td>{auditResourceLabel(row.resource_type)}</Td>
                <Td>
                  <Link
                    href={`/audit-logs/${row.id}`}
                    className="text-stone-900 underline decoration-stone-300 hover:text-orange-700 hover:decoration-orange-500"
                  >
                    詳細を見る
                  </Link>
                </Td>
              </Tr>
            ))}
          </tbody>
        </TableShell>
      )}

      <div className="mt-3 flex items-center justify-end gap-4 text-sm text-stone-500">
        <span>{total > 0 ? `${offset + 1}〜${Math.min(offset + PAGE_SIZE, total)}件を表示` : "0件"}</span>
        <div className="flex gap-2">
          {hasPrev ? (
            <Link href={buildOffsetHref(Math.max(0, offset - PAGE_SIZE))} className={buttonClasses("secondary", "sm")}>
              前へ
            </Link>
          ) : null}
          {hasNext ? (
            <Link href={buildOffsetHref(offset + PAGE_SIZE)} className={buttonClasses("secondary", "sm")}>
              次へ
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
