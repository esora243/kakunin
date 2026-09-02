import { Eye } from "lucide-react";

// Shared banner for domains that editors can inspect but cannot mutate.
export function ViewOnlyBanner({ domain }: { domain: string }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <Eye size={15} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
      <p>
        <span className="font-semibold">閲覧のみ</span> — {domain}
        の編集は管理責任者が行います。編集メンバーは内容のみ確認できます。
      </p>
    </div>
  );
}
