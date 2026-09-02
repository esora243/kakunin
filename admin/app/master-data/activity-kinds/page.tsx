import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { AccessDenied } from "@/components/AccessDenied";
import { listActivityKindsWithReferenceCounts } from "@/lib/master-data";
import { OwnerOnlyNotice } from "../_components/OwnerOnlyNotice";
import { ActivityKindRow } from "./ActivityKindRow";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableShell, THead, Th } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

export default async function ActivityKindsPage() {
  const identity = await getAdminIdentityForPage();
  if (!identity) return <AccessDenied />;
  if (identity.role !== "owner") return <OwnerOnlyNotice />;

  const rows = await listActivityKindsWithReferenceCounts();

  return (
    <div>
      <Link
        href="/master-data"
        className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-orange-700"
      >
        <ChevronLeft size={14} aria-hidden="true" />
        Master Data
      </Link>
      <PageHeader
        eyebrow="選択肢の管理"
        title="課外活動の種類"
        description="課外活動の入力画面に表示する名前と順番を変更できます。"
      />

      {rows.length === 0 ? (
        <EmptyState title="活動種別がありません" />
      ) : (
        <TableShell>
          <THead>
            <Th>管理用コード</Th>
            <Th>表示名</Th>
            <Th align="right">表示順</Th>
            <Th align="right">参照件数</Th>
            <Th />
          </THead>
          <tbody>
            {rows.map(({ activityKind, referenceCount }) => (
              <ActivityKindRow
                key={activityKind.code}
                activityKind={activityKind}
                referenceCount={referenceCount}
              />
            ))}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}
