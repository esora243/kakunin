import { AdminAccessContractCopy } from "./AdminAccessContractCopy";

export function AccessDenied() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-stone-100 px-6 text-center">
      <h1 className="text-lg font-semibold tracking-tight text-stone-900">アクセスが確認できません</h1>
      <AdminAccessContractCopy variant="denied" />
    </main>
  );
}
