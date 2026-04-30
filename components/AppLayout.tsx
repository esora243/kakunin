"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookHeart, BriefcaseBusiness, CircleUserRound, House, Sparkles } from "lucide-react";
import { Toaster } from "sonner";
import { LoginModal } from "@/components/LoginModal";
import { useAuth } from "@/components/AuthContext";

const navItems = [
  { href: "/", label: "ホーム", icon: House },
  { href: "/jobs", label: "求人", icon: BriefcaseBusiness },
  { href: "/saved", label: "保存", icon: BookHeart },
  { href: "/profile", label: "プロフィール", icon: CircleUserRound },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isLoginModalOpen, closeLoginModal, isLoggedIn, user } = useAuth();

  return (
    <>
      <div className="min-h-screen bg-brand-50 text-slate-800">
        <header className="sticky top-0 z-40 border-b border-brand-100/80 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-soft">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">Hugmeid</p>
                <p className="text-xs text-slate-500">LIFF / Supabase 実装ベース</p>
              </div>
            </Link>
            <div className="hidden items-center gap-3 text-sm sm:flex">
              <span className="rounded-full bg-brand-100 px-3 py-1 text-brand-700">
                {isLoggedIn ? `ログイン中: ${user?.name || "ユーザー"}` : "未ログイン"}
              </span>
            </div>
          </div>
          <nav className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-4 sm:px-6">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== "/" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-brand-500 text-white shadow-soft"
                      : "bg-white text-slate-600 ring-1 ring-brand-100 hover:bg-brand-100/60"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      </div>
      <LoginModal isOpen={isLoginModalOpen} onClose={closeLoginModal} />
      <Toaster richColors position="top-center" />
    </>
  );
}
