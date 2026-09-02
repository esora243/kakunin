import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { AccessDenied } from "@/components/AccessDenied";
import { listContentCategoriesWithReferenceCounts } from "@/lib/master-data";
import { OwnerOnlyNotice } from "../_components/OwnerOnlyNotice";
import { ContentCategoryRow } from "./ContentCategoryRow";
import { CreateContentCategoryForm } from "./CreateContentCategoryForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { TableShell, THead, Th } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

export default async function ContentCategoriesPage() {
  const identity = await getAdminIdentityForPage();
  if (!identity) return <AccessDenied />;
  if (identity.role !== "owner") return <OwnerOnlyNotice />;

  const rows = await listContentCategoriesWithReferenceCounts();

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
        title="記事カテゴリ"
        description="記事の入力画面に表示するカテゴリを管理できます。利用中のカテゴリは停止できません。"
      />

      <div className="mb-6">
        <Card title="新規カテゴリを作成" padding="sm">
          <CreateContentCategoryForm />
        </Card>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="カテゴリがありません" />
      ) : (
        <TableShell>
          <THead>
            <Th>管理用コード</Th>
            <Th>表示名</Th>
            <Th align="right">表示順</Th>
            <Th>状態</Th>
            <Th align="right">参照件数</Th>
            <Th />
          </THead>
          <tbody>
            {rows.map(({ category, referenceCount }) => (
              <ContentCategoryRow key={category.code} category={category} referenceCount={referenceCount} />
            ))}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}
