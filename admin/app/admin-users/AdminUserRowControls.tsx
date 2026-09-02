"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminRole } from "@/lib/auth/types";
import { SelectInput } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

type AdminUserSummary = {
  id: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
};

/**
 * Per-row role and active-state controls. Owners cannot demote or
 * deactivate their own account (docs/admin-management-app-spec.md "Owner
 * guardrails"), so those controls are hidden entirely on the acting
 * owner's own row rather than shown disabled. Every mutation goes through
 * an explicit confirm dialog first.
 */
export function AdminUserRowControls({
  adminUser,
  isSelf,
}: {
  adminUser: AdminUserSummary;
  isSelf: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(
    url: string,
    body: Record<string, unknown>,
    confirmOptions: { title: string; description?: string; danger?: boolean },
    successMessage: string,
  ) {
    const ok = await confirm({ confirmLabel: "実行する", ...confirmOptions });
    if (!ok) return;

    setPending(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const responseBody = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(responseBody?.error?.message ?? "Request failed");
      }
      toast.success(successMessage);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setPending(false);
    }
  }

  async function handleRoleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextRole = event.target.value as AdminRole;
    if (nextRole === adminUser.role) return;
    await submit(
      `/api/admin-users/${adminUser.id}/role`,
      { role: nextRole },
      { title: `${adminUser.email} の役割を ${nextRole === "owner" ? "管理責任者" : "編集メンバー"} に変更しますか？` },
      "権限を変更しました",
    );
  }

  async function handleToggleActive() {
    const nextActive = !adminUser.isActive;
    await submit(
      `/api/admin-users/${adminUser.id}/active`,
      { isActive: nextActive },
      nextActive
        ? { title: `${adminUser.email} の利用を再開しますか？` }
        : {
            title: `${adminUser.email} の利用を停止しますか？`,
            description: "実行すると対象者はすぐに管理画面を利用できなくなります。",
            danger: true,
          },
      nextActive ? "利用を再開しました" : "利用を停止しました",
    );
  }

  async function handleRemove() {
    const ok = await confirm({
      title: `${adminUser.email} を一覧から削除しますか？`,
      description: "運営メンバー一覧から非表示になります。操作履歴は保持されます。",
      confirmLabel: "一覧から削除",
      danger: true,
    });
    if (!ok) return;

    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin-users/${adminUser.id}`, { method: "DELETE" });
      const responseBody = await response.json().catch(() => null);
      if (!response.ok) throw new Error(responseBody?.error?.message ?? "削除できませんでした");
      toast.success("一覧から削除しました");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除できませんでした");
    } finally {
      setPending(false);
    }
  }

  if (isSelf) {
    return <span className="text-xs text-stone-400">(自分のアカウントは変更できません)</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <div className="w-28">
          <SelectInput aria-label={`${adminUser.email} の役割`} value={adminUser.role} onChange={handleRoleChange} disabled={pending}>
            <option value="editor">編集メンバー</option>
            <option value="owner">管理責任者</option>
          </SelectInput>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={adminUser.isActive ? "border-red-300 text-red-700 hover:border-red-400 hover:bg-red-50" : undefined}
          onClick={handleToggleActive}
          disabled={pending}
        >
          {pending ? "保存中..." : adminUser.isActive ? "利用停止" : "利用再開"}
        </Button>
        {!adminUser.isActive ? (
          <Button type="button" variant="danger" size="sm" onClick={handleRemove} disabled={pending}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            一覧から削除
          </Button>
        ) : null}
      </div>
      {error ? <span className="max-w-[14rem] text-right text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
