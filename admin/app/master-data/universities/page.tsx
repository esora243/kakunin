import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { AccessDenied } from "@/components/AccessDenied";
import { listUniversities } from "@/lib/master-data";
import { OwnerOnlyNotice } from "../_components/OwnerOnlyNotice";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableShell, THead, Th, Tr, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

// View-only per docs/admin-management-app-spec.md Master Data row for
// `universities`: "Public/profile data dependency is too broad for launch
// edits." No mutation routes exist for this table.
export default async function UniversitiesPage() {
  const identity = await getAdminIdentityForPage();
  if (!identity) return <AccessDenied />;
  if (identity.role !== "owner") return <OwnerOnlyNotice />;

  const universities = await listUniversities({ includeInactive: true });

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
        title="大学"
        description="プロフィールと学校画面に表示する大学です。現在は閲覧のみ可能です。"
        actions={<StatusBadge variant="muted">閲覧のみ</StatusBadge>}
      />

      {universities.length === 0 ? (
        <EmptyState title="大学データがありません" />
      ) : (
        <TableShell>
          <THead>
            <Th>名称</Th>
            <Th>地域</Th>
            <Th>都道府県</Th>
            <Th>市区町村</Th>
            <Th>状態</Th>
          </THead>
          <tbody>
            {universities.map((university) => (
              <Tr key={university.id}>
                <Td>{university.name}</Td>
                <Td className="text-stone-500">{university.regionCode ?? "-"}</Td>
                <Td className="text-stone-500">{university.prefecture ?? "-"}</Td>
                <Td className="text-stone-500">{university.city ?? "-"}</Td>
                <Td>
                  {university.isActive ? (
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
