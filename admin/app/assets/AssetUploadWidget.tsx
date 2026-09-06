"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";

export function AssetUploadWidget() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadInFlightRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageVariant, setMessageVariant] = useState<"error" | "warning" | "success">("success");

  async function handleUpload() {
    if (uploadInFlightRef.current) return;
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setMessageVariant("error");
      setMessage("JPEG PNG WebPのいずれかを選択してください。");
      return;
    }

    uploadInFlightRef.current = true;
    setPending(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/assets/upload", { method: "POST", body: formData });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Upload failed");
      }
      if (body.warning?.reason === "public_url_unreadable") {
        setMessageVariant("warning");
        setMessage(
          "画像を追加しましたが、公開サイトから読み取れませんでした。公開前に画像を確認してください。",
        );
      } else {
        setMessageVariant("success");
        setMessage("画像を追加しました。");
      }
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setMessageVariant("error");
      setMessage(err instanceof Error ? err.message : "画像の追加に失敗しました");
    } finally {
      uploadInFlightRef.current = false;
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          aria-label="追加する画像を選択"
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="text-xs text-stone-600 file:mr-3 file:rounded-md file:border file:border-stone-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-stone-700 file:hover:bg-stone-50"
        />
        <Button type="button" size="sm" onClick={handleUpload} disabled={pending}>
          {pending ? "アップロード中..." : "アップロード"}
        </Button>
      </div>
      {message ? <Banner variant={messageVariant}>{message}</Banner> : null}
    </div>
  );
}
