"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { AdminRole } from "@/lib/auth/types";
import { FieldLabel, TextInput, SelectInput, FieldHint } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { toast } from "sonner";

/**
 * Admin-user changes require an explicit confirmation step per
 * docs/admin-management-app-spec.md "Owner guardrails".
 */
export function CreateAdminUserForm() {
  const router = useRouter();
  const confirm = useConfirm();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("editor");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitInFlightRef = useRef(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitInFlightRef.current) return;
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    const ok = await confirm({
      title: `${trimmedEmail} を ${role} として招待しますか？`,
      confirmLabel: "招待する",
    });
    if (!ok) return;
    if (submitInFlightRef.current) return;

    submitInFlightRef.current = true;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, role }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Failed to create admin user");
      }
      setEmail("");
      setRole("editor");
      toast.success("招待しました");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create admin user");
    } finally {
      submitInFlightRef.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="flex w-64 flex-col gap-1">
        <FieldLabel htmlFor="admin-user-email">メールアドレス</FieldLabel>
        <TextInput
          id="admin-user-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.com"
        />
      </div>
      <div className="flex w-32 flex-col gap-1">
        <FieldLabel htmlFor="admin-user-role">役割</FieldLabel>
        <SelectInput
          id="admin-user-role"
          value={role}
          onChange={(event) => setRole(event.target.value as AdminRole)}
        >
          <option value="editor">編集メンバー</option>
          <option value="owner">管理責任者</option>
        </SelectInput>
      </div>
      <Button type="submit" disabled={pending} size="md">
        {pending ? "招待中..." : "招待する"}
      </Button>
      <FieldHint>編集メンバーは記事を編集できます。管理責任者はメンバー管理と操作履歴の確認もできます。</FieldHint>
      {error ? (
        <div className="w-full">
          <Banner variant="error">{error}</Banner>
        </div>
      ) : null}
    </form>
  );
}
