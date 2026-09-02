"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";

/**
 * Owner-only destructive action. Per spec, destructive actions require
 * explicit confirmation; editors never see this control at all rather than
 * a disabled version of it.
 */
export function DeleteAssetButton({ id, mode }: { id: string; mode: "delete" | "purge" }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitAction(action: "delete" | "purge") {
    const confirmed = await confirm(
      action === "delete"
        ? {
            title: "アセットを削除しますか？",
            description: "一覧から削除します。完全削除するまでは復元できます。",
            confirmLabel: "削除する",
            danger: true,
          }
        : {
            title: "画像を完全に削除しますか？",
            description: "保存領域から完全に削除します。この操作は取り消せません。",
            confirmLabel: "完全に削除する",
            danger: true,
          },
    );
    if (!confirmed) return;

    setPending(true);
    setError(null);
    try {
      const response =
        action === "delete"
          ? await fetch(`/api/assets/${id}`, { method: "DELETE" })
          : await fetch(`/api/assets/${id}/purge`, { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error?.message ?? `Failed to ${action} asset`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} asset`);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className={mode === "delete" ? "border-red-300 text-red-700 hover:border-red-400 hover:bg-red-50" : undefined}
        onClick={() => submitAction(mode)}
        disabled={pending}
      >
        {pending ? "処理中..." : mode === "delete" ? "削除" : "完全削除"}
      </Button>
      {error ? <span className="max-w-[10rem] text-right text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
