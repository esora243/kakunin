export function LogoutButton() {
  return (
    <a
      href="/logout"
      className="rounded-md px-1.5 py-1 text-xs font-medium text-stone-500 underline decoration-stone-300 hover:text-orange-700 hover:decoration-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
    >
      ログアウト
    </a>
  );
}
