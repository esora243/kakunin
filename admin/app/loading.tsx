import { Loader2 } from "lucide-react";

export default function AdminLoading() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-stone-500">
      <Loader2 size={22} className="animate-spin text-orange-600" aria-hidden="true" />
      <p className="text-sm">読み込み中です…</p>
    </main>
  );
}
