import type { AdminRole } from "./auth/types";

/** Presentation-only grouping for the sidebar; does not affect visibility. */
export type NavGroup = "content" | "operations" | "management";

export type NavItem = {
  href: string;
  label: string;
  /** Roles that can see this item. Both roles see it unless restricted. */
  roles: AdminRole[];
  /** Editors can inspect these owner-editable launch domains but cannot mutate them. */
  readOnlyForEditor?: boolean;
  /** Sidebar section this item is rendered under. Omitted for standalone items. */
  group?: NavGroup;
};

// Navigation and per-role visibility per docs/admin-management-app-spec.md
// "Navigation": editors see everything except Master Data, Admin Users, and
// Audit Logs.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "ホーム", roles: ["owner", "editor"] },
  { href: "/contents", label: "記事", roles: ["owner", "editor"], group: "content" },
  { href: "/jobs", label: "求人", roles: ["owner", "editor"], readOnlyForEditor: true, group: "content" },
  { href: "/activities", label: "課外活動", roles: ["owner", "editor"], readOnlyForEditor: true, group: "content" },
  { href: "/school", label: "学校・授業", roles: ["owner", "editor"], readOnlyForEditor: true, group: "content" },
  { href: "/inquiries", label: "お問い合わせ", roles: ["owner", "editor"], group: "operations" },
  { href: "/assets", label: "画像・ファイル", roles: ["owner", "editor"], group: "operations" },
  { href: "/master-data", label: "選択肢の管理", roles: ["owner"], group: "management" },
  { href: "/admin-users", label: "運営メンバー", roles: ["owner"], group: "management" },
  { href: "/audit-logs", label: "操作履歴", roles: ["owner"], group: "management" },
];

export function navItemsForRole(role: AdminRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
