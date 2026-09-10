import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { AccessDenied } from "@/components/AccessDenied";
import { listSpecialties } from "@/lib/master-data";
import { OwnerOnlyNotice } from "../_components/OwnerOnlyNotice";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableShell, THead, Th, Tr, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

// View-only per docs/admin-management-app-spec.md Master Data row for
// `specialties`: "Profile data dependency is too broad for launch edits."
// No mutation routes exist for this table.
export default async function SpecialtiesPage() {
  const identity = await getAdminIdentityForPage();
  if (!identity) return <AccessDenied />;
  if (identity.role !== "owner") return <OwnerOnlyNotice />;

  const specialties = await listSpecialties();

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
        title="専門分野"
        description="プロフィール入力画面に表示する選択肢です。現在は閲覧のみ可能です。"
        actions={<StatusBadge variant="muted">閲覧のみ</StatusBadge>}
      />

      {specialties.length === 0 ? (
        <EmptyState title="専門分野データがありません" />
      ) : (
        <TableShell>
          <THead>
            <Th>名称</Th>
            <Th>状態</Th>
          </THead>
          <tbody>
            {specialties.map((specialty) => (
              <Tr key={specialty.id}>
                <Td>{specialty.name}</Td>
                <Td>
                  {specialty.isActive ? (
                    <StatusBadge variant="success">有効</StatusBadge>
                  ) : (
                    <StatusBadge variant="muted">無効</StatusBadge>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}
