"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  GraduationCap,
  Users,
  MessageCircle,
  User,
  Building2,
  BookOpen,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { LoginModal } from "./LoginModal";
import { Toaster, toast } from "sonner";
import type { ReactNode } from "react";

/**
 * AppLayout
 * - Hugmeid mock のヘッダーデザインを完全反映:
 *   1) 全体背景: bg-[#FFF9FA]
 *   2) ロゴ: orange-400→orange-500 のグラデーション + サブコピー「6万人の医学生で創る縁」
 *   3) ナビ: 学校 / 課外活動 / 記事 / 繋がり / マイページ + 右端 スポンサー
 *      ※ 求人(jobs) は要件定義書/画面遷移書に基づき "学校" タブ配下のサブタブから
 *        独立した /jobs ルートとしてアクセス可能だが、トップナビからは除外し、
 *        Hugmeid mock のナビ構成を採用。
 *   4) Active 状態: text-orange-500 + bg-orange-50 のピル形状
 *   5) モバイル時はボトムナビ(同じ5項目)を表示
 *
 * - 機能保持:
 *   - LINE LIFF を想定したログイン (LoginModal)
 *   - 認証必要なナビ(マイページ)はモーダル誘導
 *   - sonner Toaster 維持
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    isLoggedIn,
    isLoginModalOpen,
    openLoginModal,
    closeLoginModal,
    login,
  } = useAuth();

  const handleAuthRequired = (path: string) => {
    if (isLoggedIn) {
      router.push(path);
    } else {
      openLoginModal();
    }
  };

  // Hugmeid mock の navItems を踏襲(求人は学校/マイページから導線)
  const navItems = [
    { name: "学校", path: "/school", icon: GraduationCap },
    { name: "課外活動", path: "/activities", icon: Users },
    { name: "記事", path: "/articles", icon: BookOpen },
    { name: "繋がり", path: "/connect", icon: MessageCircle },
    { name: "マイページ", path: "/profile", icon: User, requiresAuth: true },
  ];

  const isActivePath = (path: string) =>
    pathname === path || pathname.startsWith(path + "/");

  return (
    <div className="flex flex-col min-h-screen bg-[#FFF9FA] text-gray-800 font-sans">
      <Toaster position="top-center" />

      {/* ============================================================
          ナビゲーションヘッダー (Hugmeid mock 準拠の2段構造)
          上段: ロゴ(グラデーション) + サブコピー
          下段: 5アイコン中央 + 右端スポンサー
         ============================================================ */}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-orange-100 shadow-sm">
        {/* === 上段: ロゴ === */}
        <div className="flex items-center justify-center px-4 py-2 border-b border-orange-50">
          <Link
            href="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              Hm
            </div>
            <div className="flex flex-col">
              <h1 className="text-base md:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-400 tracking-tight leading-tight">
                HugNavi
              </h1>
              <p className="text-[9px] md:text-[10px] text-gray-500 tracking-wide font-light whitespace-nowrap">
                6万人の医学生で創る縁
              </p>
            </div>
          </Link>
        </div>

        {/* === 下段: ナビゲーション (sm以上) === */}
        <div className="hidden sm:flex items-center justify-between px-2 py-1">
          <div className="flex items-center gap-0.5 flex-1 justify-center">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(item.path);

              if (item.requiresAuth) {
                return (
                  <button
                    key={item.name}
                    onClick={() => handleAuthRequired(item.path)}
                    className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 transition-colors rounded-lg min-w-[64px] ${
                      active
                        ? "text-orange-500 bg-orange-50"
                        : "text-gray-600 hover:text-orange-400 hover:bg-orange-50/50"
                    }`}
                  >
                    <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                    <span className="text-[10px] font-medium whitespace-nowrap">
                      {item.name}
                    </span>
                  </button>
                );
              }

              return (
                <Link
                  key={item.name}
                  href={item.path}
                  className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 transition-colors rounded-lg min-w-[64px] ${
                    active
                      ? "text-orange-500 bg-orange-50"
                      : "text-gray-600 hover:text-orange-400 hover:bg-orange-50/50"
                  }`}
                >
                  <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                  <span className="text-[10px] font-medium whitespace-nowrap">
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* === スポンサー (右端) === */}
          <Link
            href="/sponsors"
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 transition-colors rounded-lg ml-1 ${
              isActivePath("/sponsors")
                ? "text-orange-500 bg-orange-50"
                : "text-gray-600 hover:text-orange-500 hover:bg-orange-50"
            }`}
          >
            <Building2 size={18} />
            <span className="text-[10px] font-medium whitespace-nowrap">
              スポンサー
            </span>
          </Link>
        </div>

        {/* === 下段(モバイル時): ロゴだけにし、ナビはボトムへ === */}
      </nav>

      {/* ============================================================
          メインコンテンツ
         ============================================================ */}
      <main className="flex-1 overflow-x-hidden sm:pb-0 pb-20">{children}</main>

      {/* ============================================================
          モバイル用ボトムナビゲーション
         ============================================================ */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-orange-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-safe">
        <div className="flex items-center justify-around px-2 py-2">
          {[...navItems, { name: "スポンサー", path: "/sponsors", icon: Building2 }].map(
            (item) => {
              const Icon = item.icon;
              const active = isActivePath(item.path);

              if ("requiresAuth" in item && item.requiresAuth) {
                return (
                  <button
                    key={item.name}
                    onClick={() => handleAuthRequired(item.path)}
                    className={`flex flex-col items-center justify-center gap-0.5 p-1.5 flex-1 ${
                      active ? "text-orange-500" : "text-gray-400 hover:text-orange-400"
                    }`}
                  >
                    <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                    <span className="text-[9px] font-bold">{item.name}</span>
                  </button>
                );
              }

              return (
                <Link
                  key={item.name}
                  href={item.path}
                  className={`flex flex-col items-center justify-center gap-0.5 p-1.5 flex-1 ${
                    active ? "text-orange-500" : "text-gray-400 hover:text-orange-400"
                  }`}
                >
                  <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                  <span className="text-[9px] font-bold">{item.name}</span>
                </Link>
              );
            },
          )}
        </div>
      </nav>

      {/* ============================================================
          LINE LIFF ログインモーダル
         ============================================================ */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={closeLoginModal}
        onLogin={() => {
          login();
          toast.success("LINEでログインしました");
        }}
      />
    </div>
  );
}
