"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-sm rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <AlertTriangle size={22} className="mx-auto text-red-600" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold tracking-tight text-stone-900">エラーが発生しました</h1>
        <p className="mt-2 text-sm text-stone-500">このページの読み込み中に問題が発生しました。</p>
        {error.digest ? <p className="mt-3 font-mono text-xs text-stone-400">Reference: {error.digest}</p> : null}
        <Button type="button" onClick={reset} size="sm" className="mt-4 w-full">
          再試行
        </Button>
      </div>
    </main>
  );
}
