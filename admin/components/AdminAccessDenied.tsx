import { Circle } from "lucide-react";
import { AdminAccessContractCopy } from "./AdminAccessContractCopy";
import { buttonClasses } from "./ui/Button";
import { cx } from "./ui/cn";

export function AdminAccessDenied() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-stone-100 px-6">
      <div className="w-full max-w-sm rounded-lg border border-stone-200 bg-white p-6 text-center shadow-sm">
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-stone-900">
          <Circle size={6} className="fill-orange-600 text-orange-600" aria-hidden="true" />
          Hugmeid Admin
        </div>
        <AdminAccessContractCopy className="mt-3 text-left" variant="denied" />
        <a href="/auth/google" className={cx(buttonClasses("primary", "md"), "mt-4 w-full")}>
          Google でサインイン
        </a>
      </div>
    </main>
  );
}
