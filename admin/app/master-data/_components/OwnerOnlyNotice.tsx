// Master Data is an owner-only domain end to end per docs/admin-management-app-spec.md
// "Roles And Permissions" (editors: "Not allowed... Edit master data") and
// "Navigation" (only owners see the Master Data section). The nav already
// hides the link for editors, but every page still server-side gates on role
// in case an editor navigates to the URL directly.
export function OwnerOnlyNotice() {
  return (
    <main className="flex flex-col items-start gap-3">
      <h1 className="text-lg font-semibold tracking-tight text-stone-900">オーナーのみ</h1>
      <p className="max-w-md text-sm text-stone-500">
        マスターデータの管理はオーナー権限のみに許可されています。閲覧・編集が必要な場合はオーナーに依頼してください。
      </p>
    </main>
  );
}
