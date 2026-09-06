import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";

export default function AdminNotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-sm rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold tracking-tight text-stone-900">ページが見つかりません</h1>
        <p className="mt-2 text-sm text-stone-500">指定されたページは存在しません。移動済みの可能性もあります。</p>
        <Link href="/" className={`${buttonClasses("secondary", "sm")} mt-4 w-full`}>
          トップへ戻る
        </Link>
      </div>
    </main>
  );
}
