"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Briefcase, GraduationCap, Users, MessageCircle, User, Building2 } from "lucide-react";
import { useAuth } from "./AuthContext";
import { LoginModal } from "./LoginModal";
import { Toaster, toast } from "sonner";
import type { ReactNode } from "react";

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoggedIn, isLoginModalOpen, openLoginModal, closeLoginModal, login } = useAuth();

  const handleAuthRequired = (path: string) => {
    if (isLoggedIn) {
      router.push(path);
    } else {
      openLoginModal();
    }
  };

  const navItems = [
    { name: "求人", path: "/jobs", icon: Briefcase },
    { name: "学校", path: "/school", icon: GraduationCap },
    { name: "課外活動", path: "/activities", icon: Users },
    { name: "繋がり", path: "/connect", icon: MessageCircle },
    { name: "マイページ", path: "/profile", icon: User, requiresAuth: true },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#FFF9FA] text-gray-800 font-sans">
      <Toaster position="top-center" />

      {/* ========================================================= */}
      {/* Navigation Header (白いヘッダーのみ残す) */}
      {/* ========================================================= */}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-orange-100 shadow-sm flex items-center justify-between px-4 h-16 md:h-20">
        
        {/* Logo Section */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm md:text-lg shadow-sm">
            Hm
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg md:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-400 tracking-tight leading-none">
              Hugmeid
            </h1>
            <p className="text-[10px] text-gray-500 tracking-wide font-medium mt-0.5">
              6万人の医学生で創る縁
            </p>
          </div>
        </Link>

        {/* Navigation Items (中央配置) */}
        <div className="hidden sm:flex items-center gap-2 md:gap-6 absolute left-1/2 transform -translate-x-1/2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path || pathname.startsWith(item.path + "/");

            if (item.requiresAuth) {
              return (
                <button
                  key={item.name}
                  onClick={() => handleAuthRequired(item.path)}
                  className={`flex flex-col items-center justify-center gap-1 px-3 py-2 transition-colors rounded-xl min-w-[70px] ${
                    isActive ? "text-orange-500 bg-orange-50" : "text-gray-500 hover:text-orange-500 hover:bg-orange-50/50"
                  }`}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-[11px] font-bold whitespace-nowrap">{item.name}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.name}
                href={item.path}
                className={`flex flex-col items-center justify-center gap-1 px-3 py-2 transition-colors rounded-xl min-w-[70px] ${
                  isActive ? "text-orange-500 bg-orange-50" : "text-gray-500 hover:text-orange-500 hover:bg-orange-50/50"
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[11px] font-bold whitespace-nowrap">{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Sponsors Link (右端) */}
        <div className="flex items-center">
          <Link
            href="/sponsors"
            className={`flex flex-col items-center justify-center gap-1 px-3 py-2 transition-colors rounded-xl min-w-[70px] ${
              pathname === "/sponsors" ? "text-orange-500 bg-orange-50" : "text-gray-500 hover:text-orange-500 hover:bg-orange-50/50"
            }`}
          >
            <Building2 size={20} strokeWidth={pathname === "/sponsors" ? 2.5 : 2} />
            <span className="text-[11px] font-bold whitespace-nowrap">スポンサー</span>
          </Link>
        </div>
      </nav>

      {/* ========================================================= */}
      {/* モバイル用 ボトムナビゲーション (画面が小さい時のみ表示) */}
      {/* ========================================================= */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-safe">
        <div className="flex items-center justify-around px-2 py-2">
           {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path || pathname.startsWith(item.path + "/");

            if (item.requiresAuth) {
              return (
                <button
                  key={item.name}
                  onClick={() => handleAuthRequired(item.path)}
                  className={`flex flex-col items-center justify-center gap-1 p-2 flex-1 ${
                    isActive ? "text-orange-500" : "text-gray-400 hover:text-orange-400"
                  }`}
                >
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-[9px] font-bold">{item.name}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.name}
                href={item.path}
                className={`flex flex-col items-center justify-center gap-1 p-2 flex-1 ${
                  isActive ? "text-orange-500" : "text-gray-400 hover:text-orange-400"
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[9px] font-bold">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ========================================================= */}
      {/* Main Content */}
      {/* ========================================================= */}
      {/* モバイル時は下部ナビの分（pb-20）余白を空ける */}
      <main className="flex-1 overflow-x-hidden sm:pb-0 pb-20">
        {children}
      </main>

      {/* Login Modal */}
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