"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";

async function parseError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  return body?.error?.message ?? "Restore failed";
}

export function RestoreVersionButton({ contentId, versionNo }: { contentId: string; versionNo: number }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function restore() {
    const confirmed = await confirm({
      title: `バージョン ${versionNo} を復元しますか？`,
      description: "新しい下書きを作成します。復元した内容は非公開です。",
      confirmLabel: "復元する",
      danger: true,
    });
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/contents/${contentId}/versions/${versionNo}/restore`, { method: "POST" });
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }
      router.push(`/contents/${contentId}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button type="button" variant="secondary" size="sm" onClick={() => void restore()} disabled={saving}>
        Restore
      </Button>
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
    </div>
  );
}
