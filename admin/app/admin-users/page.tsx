import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { AccessDenied } from "@/components/AccessDenied";
import { listAdminUserRows } from "@/lib/admin-users";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { TableShell, THead, Th, Tr, Td, TdMono } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Users } from "lucide-react";
import { CreateAdminUserForm } from "./CreateAdminUserForm";
import { AdminUserRowControls } from "./AdminUserRowControls";

export const dynamic = "force-dynamic";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function AdminUsersPage() {
  const identity = await getAdminIdentityForPage();
  if (!identity) return <AccessDenied />;

  // Owner-only per docs/admin-management-app-spec.md "Owner": "Manage admin
  // users." and "Navigation": editors do not see this section at all.
  if (identity.role !== "owner") {
    return (
      <main className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-lg font-semibold text-stone-900">アクセスできません</h1>
        <p className="max-w-md text-sm text-stone-500">
          運営メンバーの管理は管理責任者のみ利用できます。
        </p>
      </main>
    );
  }

  const adminUsers = await listAdminUserRows();

  return (
    <div>
      <PageHeader eyebrow="運営管理" title="運営メンバー" description="管理画面を利用できるメンバーと権限を管理します。" meta={<span>{adminUsers.length} 件</span>} />

      <div>
        <Card title="運営メンバーを追加" description="メールアドレスと役割を指定します。">
          <CreateAdminUserForm />
        </Card>
      </div>

      <div className="mt-6">
        {adminUsers.length === 0 ? (
          <EmptyState icon={Users} title="運営メンバーがまだいません" />
        ) : (
          <TableShell>
            <THead>
              <Th>メールアドレス</Th>
              <Th>役割</Th>
              <Th>状態</Th>
              <Th align="right">作成日時</Th>
              <Th align="right">操作</Th>
            </THead>
            <tbody>
              {adminUsers.map((adminUser) => {
                const isSelf = adminUser.id === identity.adminId;
                return (
                  <Tr key={adminUser.id} className={!adminUser.isActive ? "opacity-50" : undefined}>
                    <Td>
                      <span className="font-semibold text-stone-900">{adminUser.email}</span>
                      {isSelf ? (
                        <span className="ml-2 inline-flex items-center rounded-md border border-stone-200 bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-500">
                          自分
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <span
                        className={
                          adminUser.role === "owner"
                            ? "inline-flex items-center rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700"
                            : "inline-flex items-center rounded-md border border-stone-200 bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600"
                        }
                      >
                        {adminUser.role === "owner" ? "管理責任者" : "編集メンバー"}
                      </span>
                    </Td>
                    <Td>
                      {adminUser.isActive ? (
                        <StatusBadge variant="success">利用中</StatusBadge>
                      ) : (
                        <StatusBadge variant="muted">利用停止</StatusBadge>
                      )}
                    </Td>
                    <TdMono align="right">{formatDate(adminUser.createdAt)}</TdMono>
                    <Td align="right">
                      <AdminUserRowControls
                        adminUser={{ id: adminUser.id, email: adminUser.email, role: adminUser.role, isActive: adminUser.isActive }}
                        isSelf={isSelf}
                      />
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
      </div>
    </div>
  );
}
