import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { AccessDenied } from "@/components/AccessDenied";
import { listJobCategoriesWithReferenceCounts } from "@/lib/master-data";
import { OwnerOnlyNotice } from "../_components/OwnerOnlyNotice";
import { JobCategoryRow } from "./JobCategoryRow";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableShell, THead, Th } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

export default async function JobCategoriesPage() {
  const identity = await getAdminIdentityForPage();
  if (!identity) return <AccessDenied />;
  if (identity.role !== "owner") return <OwnerOnlyNotice />;

  const rows = await listJobCategoriesWithReferenceCounts();

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
        title="求人カテゴリ"
        description="求人の入力画面に表示する職種名を変更できます。"
      />

      {rows.length === 0 ? (
        <EmptyState title="求人カテゴリがありません" />
      ) : (
        <TableShell>
          <THead>
            <Th>管理用コード</Th>
            <Th>表示名</Th>
            <Th align="right">参照件数</Th>
            <Th />
          </THead>
          <tbody>
            {rows.map(({ jobCategory, referenceCount }) => (
              <JobCategoryRow key={jobCategory.id} jobCategory={jobCategory} referenceCount={referenceCount} />
            ))}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}
