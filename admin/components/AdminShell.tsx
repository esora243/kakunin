"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Menu,
  X,
  LayoutDashboard,
  FileText,
  Briefcase,
  CalendarRange,
  GraduationCap,
  Inbox,
  Image as ImageIcon,
  Database,
  Users,
  ScrollText,
  Circle,
  type LucideIcon,
} from "lucide-react";
import { Toaster } from "sonner";
import { navItemsForRole, type NavItem } from "@/lib/nav";
import type { AdminRole } from "@/lib/auth/types";
import { LogoutButton } from "./LogoutButton";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { cx } from "./ui/cn";

const NAV_ICONS: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/contents": FileText,
  "/jobs": Briefcase,
  "/activities": CalendarRange,
  "/school": GraduationCap,
  "/inquiries": Inbox,
  "/assets": ImageIcon,
  "/master-data": Database,
  "/admin-users": Users,
  "/audit-logs": ScrollText,
};

const GROUP_LABELS: Record<string, string> = {
  content: "公開情報",
  operations: "運用",
  management: "管理",
};

const GROUP_ORDER = ["content", "operations", "management"] as const;

function groupNavItems(items: NavItem[]) {
  const solo = items.filter((item) => !item.group);
  const groups = new Map<string, NavItem[]>();
  for (const item of items) {
    if (!item.group) continue;
    const list = groups.get(item.group) ?? [];
    list.push(item);
    groups.set(item.group, list);
  }
  return { solo, groups };
}

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

function NavLink({
  item,
  active,
  role,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  role: AdminRole;
  onNavigate?: () => void;
}) {
  const Icon = NAV_ICONS[item.href] ?? FileText;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cx(
        "flex items-center gap-2.5 rounded-md border-l-2 px-2.5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40",
        active
          ? "border-orange-600 bg-stone-100 font-medium text-stone-900"
          : "border-transparent text-stone-600 hover:bg-stone-50 hover:text-stone-900",
      )}
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
      <span className="flex-1">{item.label}</span>
      {item.readOnlyForEditor && role === "editor" ? (
        <span className="rounded-sm bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">閲覧のみ</span>
      ) : null}
    </Link>
  );
}

function NavGroups({
  items,
  pathname,
  role,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  role: AdminRole;
  onNavigate?: () => void;
}) {
  const { solo, groups } = groupNavItems(items);

  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      <div className="flex flex-col gap-1">
        {solo.map((item) => (
          <NavLink key={item.href} item={item} active={isActivePath(pathname, item.href)} role={role} onNavigate={onNavigate} />
        ))}
      </div>
      {GROUP_ORDER.map((groupKey) => {
        const groupItems = groups.get(groupKey);
        if (!groupItems || groupItems.length === 0) return null;
        return (
          <div key={groupKey} className="flex flex-col gap-1">
            <p className="px-2.5 text-[11px] font-medium uppercase tracking-wider text-stone-400">{GROUP_LABELS[groupKey]}</p>
            {groupItems.map((item) => (
              <NavLink key={item.href} item={item} active={isActivePath(pathname, item.href)} role={role} onNavigate={onNavigate} />
            ))}
          </div>
        );
      })}
    </nav>
  );
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1 text-sm font-semibold text-stone-900">
      <Circle size={6} className="fill-orange-600 text-orange-600" aria-hidden="true" />
      Hugmeid Admin
    </div>
  );
}

function UserBlock({ identity }: { identity: { email: string; role: AdminRole } }) {
  return (
    <div className="border-t border-stone-200 px-3 py-3">
      <div className="truncate text-sm text-stone-700" title={identity.email}>
        {identity.email}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="rounded-sm bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-500">
          {identity.role === "owner" ? "管理責任者" : "編集メンバー"}
        </span>
        <LogoutButton />
      </div>
    </div>
  );
}

export function AdminShell({
  identity,
  children,
}: {
  identity: { email: string; role: AdminRole };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const items = navItemsForRole(identity.role);

  return (
    <ConfirmDialog>
      <div className="flex min-h-screen bg-stone-100">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-stone-200 bg-white lg:flex">
          <div className="border-b border-stone-200 px-1 py-3">
            <Wordmark />
          </div>
          <NavGroups items={items} pathname={pathname} role={identity.role} />
          <UserBlock identity={identity} />
        </aside>

        {isNavOpen ? (
          <div className="fixed inset-0 z-40 bg-stone-900/40 lg:hidden" onClick={() => setIsNavOpen(false)} aria-hidden="true" />
        ) : null}
        <aside
          className={cx(
            "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col bg-white transition-transform duration-200 lg:hidden",
            isNavOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-center justify-between border-b border-stone-200 px-2 py-3">
            <Wordmark />
            <button
              type="button"
              onClick={() => setIsNavOpen(false)}
              aria-label="メニューを閉じる"
              className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <NavGroups items={items} pathname={pathname} role={identity.role} onNavigate={() => setIsNavOpen(false)} />
          <UserBlock identity={identity} />
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-60">
          <div className="flex items-center gap-3 border-b border-stone-200 bg-white px-4 py-3 lg:hidden">
            <button
              type="button"
              onClick={() => setIsNavOpen(true)}
              aria-label="メニューを開く"
              className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
            >
              <Menu size={18} aria-hidden="true" />
            </button>
            <Wordmark />
          </div>
          <main className="flex-1 px-6 py-6">
            <div className="mx-auto max-w-[1200px]">{children}</div>
          </main>
        </div>
      </div>
      <Toaster position="bottom-right" richColors={false} />
    </ConfirmDialog>
  );
}
