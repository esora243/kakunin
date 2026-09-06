"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ContentCategoryRow as ContentCategoryRowType } from "@/lib/master-data";
import { Tr, Td, TdMono } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { TextInput, FieldError } from "@/components/ui/Form";

export function ContentCategoryRow({
  category,
  referenceCount,
}: {
  category: ContentCategoryRowType;
  referenceCount: number;
}) {
  const router = useRouter();
  const [name, setName] = useState(category.name);
  const [displayOrder, setDisplayOrder] = useState(category.displayOrder);
  const [isActive, setIsActive] = useState(category.isActive);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = name !== category.name || displayOrder !== category.displayOrder || isActive !== category.isActive;
  const deactivateBlocked = referenceCount > 0 && category.isActive;

  async function handleSave() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/master-data/content-categories/${encodeURIComponent(category.code)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, displayOrder, isActive }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Failed to update category");
      }
      if (body?.cacheWarning) setError("保存しましたが、公開サイトへの反映を再試行する必要があります。");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update category");
    } finally {
      setPending(false);
    }
  }

  return (
    <Tr className="align-top">
      <TdMono>{category.code}</TdMono>
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
      <Td>
        <label className="flex items-center gap-2 text-xs text-stone-600">
          <input
            type="checkbox"
            checked={isActive}
            disabled={deactivateBlocked}
            onChange={(event) => setIsActive(event.target.checked)}
            className="h-3.5 w-3.5 rounded-sm border-stone-300 text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 disabled:opacity-50"
          />
          有効
        </label>
        {deactivateBlocked ? (
          <p className="mt-1 max-w-[10rem] text-[11px] text-amber-700">
            公開中のコンテンツ{referenceCount}件が参照中のため無効化できません
          </p>
        ) : null}
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
