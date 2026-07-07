"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Briefcase,
  GraduationCap,
  Users,
  User,
  BookOpen,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { LoginModal } from "./LoginModal";
import { LegalConsentModal } from "./LegalConsentModal";
import { LEGAL_CONSENT_STORAGE_KEY, LEGAL_CONSENT_VERSION } from "@/lib/legal";
import { Toaster, toast } from "sonner";
import type { ReactNode } from "react";

/**
 * AppLayout
 * - TestAPP のネイビー系ナビゲーションを移植。
 * - 上部の疑似ブラウザヘッダー(- / タイトル / ×) と 下部の疑似ブラウザ
 *   ツールバー (← → ⟳ 共有 メニュー) は削除済み。
 * - ロゴ表記 (Hn / HagNavi / HugNavi) はナビからは表示しない。
 * - 5タブ(求人 / 学校 / 課外活動 / 記事 / マイページ)。スポンサータブは廃止。
 * - 初回起動時に LegalConsentModal (利用規約 / プライバシーポリシー同意) を表示。
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

  // ---- 初回起動時の利用規約 同意モーダル制御 ----
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(LEGAL_CONSENT_STORAGE_KEY);
      if (!stored) {
        setIsLegalModalOpen(true);
        return;
      }
      const parsed = JSON.parse(stored) as { version?: string };
      if (parsed.version !== LEGAL_CONSENT_VERSION) {
        setIsLegalModalOpen(true);
      }
    } catch {
      setIsLegalModalOpen(true);
    }
  }, []);

  const handleLegalAgree = () => {
    try {
      window.localStorage.setItem(
        LEGAL_CONSENT_STORAGE_KEY,
        JSON.stringify({
          version: LEGAL_CONSENT_VERSION,
          agreedAt: new Date().toISOString(),
        }),
      );
    } catch {
      /* noop */
    }
    setIsLegalModalOpen(false);
  };

  const handleAuthRequired = (path: string) => {
    if (isLoggedIn) {
      router.push(path);
    } else {
      openLoginModal();
    }
  };

  // 要件: 「求人」タブ追加 / 「スポンサー」タブ廃止 (スポンサーは /jobs 内に表示)
  const navItems = [
    { name: "求人", path: "/jobs", icon: Briefcase },
    { name: "学校", path: "/school", icon: GraduationCap },
    { name: "課外活動", path: "/activities", icon: Users },
    { name: "記事", path: "/articles", icon: BookOpen },
    {
      name: "マイページ",
      path: "/profile",
      icon: User,
      requiresAuth: true,
    },
  ];

  const isActivePath = (path: string) =>
    pathname === path || pathname.startsWith(path + "/");

  return (
    <div className="flex flex-col min-h-screen bg-[#F2F4F8] text-[#1A1C24] font-sans">
      <Toaster position="top-center" />

      {/* ============================================================
          ナビゲーション (求人 / 学校 / 課外活動 / 記事 / マイページ)
          - 疑似ブラウザヘッダー・フッターは要件により削除。
         ============================================================ */}
      <nav
        className="sticky top-0 z-40 bg-white backdrop-blur-md shadow-sm"
        style={{ borderBottom: "1px solid #B9C2DB" }}
      >
        <div className="flex items-center px-1 py-1">
          <div className="flex items-center gap-0.5 flex-1 justify-around">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(item.path);

              const activeClass = "text-white rounded-lg";
              const inactiveClass = "text-gray-500 hover:rounded-lg";

              if (item.requiresAuth) {
                return (
                  <button
                    key={item.name}
                    onClick={() => handleAuthRequired(item.path)}
                    style={active ? { backgroundColor: "#1E3A8A" } : {}}
                    className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 transition-colors min-w-[58px] ${
                      active ? activeClass : inactiveClass
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
                  style={active ? { backgroundColor: "#1E3A8A" } : {}}
                  className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 transition-colors min-w-[58px] ${
                    active ? activeClass : inactiveClass
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
        </div>
      </nav>

      {/* ============================================================
          メインコンテンツ (疑似フッターを削除したためボトム余白は最小)
         ============================================================ */}
      <main className="flex-1 overflow-x-hidden pb-4">{children}</main>

      {/* ============================================================
          LINE LIFF ログインモーダル (機能保持)
         ============================================================ */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={closeLoginModal}
        onLogin={() => {
          login();
          toast.success("LINEでログインしました");
        }}
      />

      {/* ============================================================
          初回起動時 利用規約 / プライバシーポリシー 同意モーダル
         ============================================================ */}
      <LegalConsentModal
        isOpen={isLegalModalOpen}
        onAgree={handleLegalAgree}
      />
    </div>
  );
}
