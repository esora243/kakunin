"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextInput, FieldLabel, FieldError } from "@/components/ui/Form";

export function CreateContentCategoryForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitInFlightRef = useRef(false);

  async function handleSubmit() {
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/master-data/content-categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, name, displayOrder }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Failed to create category");
      }
      setCode("");
      setName("");
      setDisplayOrder(0);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      submitInFlightRef.current = false;
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-48">
        <FieldLabel htmlFor="new-category-code">コード（URL-safe, 例: campus-life）</FieldLabel>
        <TextInput
          id="new-category-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
      </div>
      <div className="w-48">
        <FieldLabel htmlFor="new-category-name">表示名</FieldLabel>
        <TextInput
          id="new-category-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="w-24">
        <FieldLabel htmlFor="new-category-order">表示順</FieldLabel>
        <TextInput
          id="new-category-order"
          type="number"
          value={displayOrder}
          onChange={(event) => setDisplayOrder(Number(event.target.value))}
        />
      </div>
      <Button
        type="button"
        size="sm"
        onClick={handleSubmit}
        disabled={pending || !code.trim() || !name.trim()}
      >
        {pending ? "作成中..." : "新規作成"}
      </Button>
      <FieldError>{error}</FieldError>
    </div>
  );
}
