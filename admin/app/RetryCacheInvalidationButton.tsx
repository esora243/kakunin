"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/Form";

/**
 * Owner-only retry control for a failed cache invalidation, per
 * docs/admin-management-app-spec.md "Cache Boundary": retry jobs for failed
 * invalidation must be visible to owners.
 */
export function RetryCacheInvalidationButton({
  jobId,
}: {
  jobId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRetry() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/dashboard/retry-cache", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const responseBody = await response.json().catch(() => null);
      if (!response.ok || !responseBody?.ok) {
        throw new Error(responseBody?.error?.message ?? "Retry failed");
      }
      toast.success("キャッシュの再無効化に成功しました");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="secondary" size="sm" onClick={handleRetry} disabled={pending}>
        {pending ? "再試行中..." : "再試行"}
      </Button>
      <div className="max-w-[12rem] text-right">
        <FieldError>{error}</FieldError>
      </div>
    </div>
  );
}
