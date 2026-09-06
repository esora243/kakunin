import { BookOpen, Briefcase, GraduationCap, User, Users } from "lucide-react";
import type { ReactNode } from "react";
import { ActiveNavLink } from "@/components/ActiveNavLink";
import { AppToaster } from "@/components/AppToaster";
import { LineFollowFloating } from "@/components/LineFollowFloating";
import { Container } from "@/components/ui/Container";

/**
 * kakunin (TestAPP) 由来 Navy デザイン仕様の AppShell:
 * - サイト名 / タグラインをヘッダーに出さない (kakunin AppLayout に準拠)。
 * - 5タブ (学校 / 求人 / 課外活動 / コンテンツ / マイページ) を画面上部の
 *   `<header>` 内の横並びタブとして配置する。
 * - タブ群は Container 内に収める。以前は `justify-around` で 1440px 全幅に
 *   広がり、10px ラベルが巨大な空白に点在していた。
 * - ヘッダー高は `--app-nav-h` (= h-16) と一致させ、各ページの sticky は
 *   `top-sticky` だけを参照する。
 */
const navBaseClass =
  "flex flex-1 max-w-[8rem] min-h-tap flex-col items-center justify-center gap-0.5 rounded-control px-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";
const navActiveClass = "bg-brand-500 text-inverse shadow-card";
const navInactiveClass = "text-secondary hover:bg-brand-50 hover:text-brand-600";

const navItems = [
  { name: "学校", path: "/school", icon: GraduationCap },
  { name: "求人", path: "/jobs", icon: Briefcase },
  { name: "課外活動", path: "/activities", icon: Users },
  { name: "コンテンツ", path: "/contents", icon: BookOpen },
  { name: "マイページ", path: "/profile", icon: User },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-canvas text-primary">
      <AppToaster />

      {/*
        ヘッダーの実高 (境界線を含む) を h-16 = 64px に固定し、`--app-nav-h` と
        1px の狂いもなく一致させる。各ページの sticky はこの値だけを参照する。
      */}
      <header className="sticky top-nav-top z-40 h-16 border-b border-strong bg-surface-card shadow-card">
        <nav aria-label="メインナビゲーション" className="h-full">
          <Container className="flex h-full items-center justify-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <ActiveNavLink
                  key={item.name}
                  href={item.path}
                  className={navBaseClass}
                  activeClassName={navActiveClass}
                  inactiveClassName={navInactiveClass}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span className="whitespace-nowrap text-micro font-medium">{item.name}</span>
                </ActiveNavLink>
              );
            })}
          </Container>
        </nav>
      </header>

      {/*
        `overflow-x-hidden` はスクロールコンテナを作ってしまい、配下の
        `position: sticky` の基準がビューポートではなく main になる
        (ヘッダーが 64px 下にずれ、スクロールしても固定されない)。
        `overflow-x-clip` は横溢れを止めつつスクロールコンテナを作らない。
      */}
      <main className="flex-1 overflow-x-clip">{children}</main>

      <LineFollowFloating />
    </div>
  );
}
