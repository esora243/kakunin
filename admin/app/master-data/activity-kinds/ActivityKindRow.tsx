"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ActivityKindRow as ActivityKindRowType } from "@/lib/master-data";
import { Tr, Td, TdMono } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { TextInput, FieldError } from "@/components/ui/Form";

export function ActivityKindRow({
  activityKind,
  referenceCount,
}: {
  activityKind: ActivityKindRowType;
  referenceCount: number;
}) {
  const router = useRouter();
  const [name, setName] = useState(activityKind.name);
  const [displayOrder, setDisplayOrder] = useState(activityKind.displayOrder);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = name !== activityKind.name || displayOrder !== activityKind.displayOrder;

  async function handleSave() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/master-data/activity-kinds/${encodeURIComponent(activityKind.code)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, displayOrder }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Failed to update activity kind");
      }
      if (body?.cacheWarning) setError("保存しましたが、公開サイトへの反映を再試行する必要があります。");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update activity kind");
    } finally {
      setPending(false);
    }
  }

  return (
    <Tr className="align-top">
      <TdMono>{activityKind.code}</TdMono>
      <Td>
        <TextInput value={name} onChange={(event) => setName(event.target.value)} className="w-40" />
      </Td>
      <Td align="right">
        <TextInput
          type="number"
          value={displayOrder}
          onChange={(event) => setDisplayOrder(Number(event.target.value))}
          className="w-20 text-right"
        />
      </Td>
      <TdMono align="right">{referenceCount}件</TdMono>
      <Td align="right">
        <Button type="button" size="sm" onClick={handleSave} disabled={pending || !dirty}>
          {pending ? "保存中..." : "保存"}
        </Button>
        <div className="mt-1 max-w-[10rem] text-right">
          <FieldError>{error}</FieldError>
        </div>
      </Td>
    </Tr>
  );
}
