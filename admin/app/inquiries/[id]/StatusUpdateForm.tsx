"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { InquiryStatus } from "@/lib/inquiries";
import { SelectInput } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { useConfirm } from "@/components/ui/ConfirmDialog";

const STATUS_OPTIONS: { value: InquiryStatus; label: string }[] = [
  { value: "open", label: "未対応" },
  { value: "in_progress", label: "対応中" },
  { value: "closed", label: "完了" },
];

// Only the transitions allowed by docs/admin-management-app-spec.md
// "Inquiries" > "Allowed transitions" are offered here; the API route and
// updateInquiryStatus() re-validate server-side regardless, since the
// client must never be trusted to only submit valid transitions.
const ALLOWED_NEXT: Record<InquiryStatus, InquiryStatus[]> = {
  open: ["in_progress", "closed"],
  in_progress: ["closed"],
  closed: ["in_progress"],
};

export function StatusUpdateForm({ inquiryId, currentStatus }: { inquiryId: string; currentStatus: InquiryStatus }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [toStatus, setToStatus] = useState<InquiryStatus | "">("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = ALLOWED_NEXT[currentStatus] ?? [];

  async function submit(confirmReopen: boolean) {
    if (!toStatus) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/inquiries/${inquiryId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromStatus: currentStatus, toStatus, confirmReopen }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "更新に失敗しました");
        return;
      }
      setToStatus("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!toStatus) return;

    // Reopen (closed -> in_progress) requires explicit confirmation per
    // spec; every other allowed transition can proceed directly.
    if (currentStatus === "closed" && toStatus === "in_progress") {
      const confirmed = await confirm({
        title: "完了済みのお問い合わせを再オープンします",
        description: "よろしいですか？",
        confirmLabel: "再オープンする",
        danger: true,
      });
      if (!confirmed) return;
      void submit(true);
      return;
    }
    void submit(false);
  }

  if (options.length === 0) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error ? <Banner variant="error">{error}</Banner> : null}
      <div className="flex items-center gap-2">
        <SelectInput
          value={toStatus}
          onChange={(event) => setToStatus(event.target.value as InquiryStatus)}
          className="w-auto"
        >
          <option value="">状態を変更…</option>
          {options.map((value) => {
            const option = STATUS_OPTIONS.find((item) => item.value === value);
            return (
              <option key={value} value={value}>
                {option?.label ?? value}
              </option>
            );
          })}
        </SelectInput>
        <Button type="submit" size="sm" disabled={!toStatus || pending}>
          {pending ? "更新中…" : "更新"}
        </Button>
      </div>
    </form>
  );
}
