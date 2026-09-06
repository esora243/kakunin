"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { EmploymentTypeRow as EmploymentTypeRowType } from "@/lib/master-data";
import { Tr, Td, TdMono } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { TextInput, FieldError } from "@/components/ui/Form";

export function EmploymentTypeRow({
  employmentType,
  referenceCount,
}: {
  employmentType: EmploymentTypeRowType;
  referenceCount: number;
}) {
  const router = useRouter();
  const [name, setName] = useState(employmentType.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = name !== employmentType.name;

  async function handleSave() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/master-data/employment-types/${employmentType.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Failed to update employment type");
      }
      if (body?.cacheWarning) setError("保存しましたが、公開サイトへの反映を再試行する必要があります。");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update employment type");
    } finally {
      setPending(false);
    }
  }

  return (
    <Tr className="align-top">
      <TdMono>{employmentType.code}</TdMono>
      <Td>
        <TextInput value={name} onChange={(event) => setName(event.target.value)} className="w-40" />
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
