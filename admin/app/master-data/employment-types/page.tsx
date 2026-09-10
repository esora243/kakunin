import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { AccessDenied } from "@/components/AccessDenied";
import { listEmploymentTypesWithReferenceCounts } from "@/lib/master-data";
import { OwnerOnlyNotice } from "../_components/OwnerOnlyNotice";
import { EmploymentTypeRow } from "./EmploymentTypeRow";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableShell, THead, Th } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

export default async function EmploymentTypesPage() {
  const identity = await getAdminIdentityForPage();
  if (!identity) return <AccessDenied />;
  if (identity.role !== "owner") return <OwnerOnlyNotice />;

  const rows = await listEmploymentTypesWithReferenceCounts();

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
        title="雇用形態"
        description="求人の入力画面に表示する雇用形態を変更できます。"
      />

      {rows.length === 0 ? (
        <EmptyState title="雇用形態がありません" />
      ) : (
        <TableShell>
          <THead>
            <Th>管理用コード</Th>
            <Th>表示名</Th>
            <Th align="right">参照件数</Th>
            <Th />
          </THead>
          <tbody>
            {rows.map(({ employmentType, referenceCount }) => (
              <EmploymentTypeRow
                key={employmentType.id}
                employmentType={employmentType}
                referenceCount={referenceCount}
              />
            ))}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}
