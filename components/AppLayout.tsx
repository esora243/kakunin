"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Briefcase, GraduationCap, Users, MessageCircle, User, Minus, X, ArrowLeft, ArrowRight, RefreshCw, Share2, Menu, Building2 } from "lucide-react";
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

      {/* Browser Header */}
      <div className="sticky top-0 z-50 bg-black text-white">
        <div className="flex items-center justify-between px-4 py-3">
          <button className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded transition-colors">
            <Minus size={18} />
          </button>
          <h2 className="text-sm font-semibold tracking-wide">Hugmeid</h2>
          <button className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded transition-colors">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Navigation Header */}
      <nav className="sticky top-[52px] z-40 bg-white/95 backdrop-blur-md border-b border-orange-100 shadow-sm">
        {/* Logo Section */}
        <div className="flex items-center justify-center px-4 py-1.5 border-b border-orange-50">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white font-bold text-xs shadow-sm">
              Hm
            </div>
            <div className="flex flex-col">
              <h1 className="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-400 tracking-tight leading-tight">
                Hugmeid
              </h1>
              <p className="text-[9px] text-gray-500 tracking-wide font-light whitespace-nowrap">
                6万人の医学生で創る縁
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation Items */}
        <div className="flex items-center justify-between px-2 py-1">
          <div className="flex items-center gap-0.5 flex-1 justify-center">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path || pathname.startsWith(item.path + "/");

              if (item.requiresAuth) {
                return (
                  <button
                    key={item.name}
                    onClick={() => handleAuthRequired(item.path)}
                    className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 transition-colors rounded-lg min-w-[60px] ${
                      isActive ? "text-orange-500 bg-orange-50" : "text-gray-600 hover:text-orange-400 hover:bg-orange-50/50"
                    }`}
                  >
                    <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-[10px] font-medium whitespace-nowrap">{item.name}</span>
                  </button>
                );
              }

              return (
                <Link
                  key={item.name}
                  href={item.path}
                  className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 transition-colors rounded-lg min-w-[60px] ${
                    isActive ? "text-orange-500 bg-orange-50" : "text-gray-600 hover:text-orange-400 hover:bg-orange-50/50"
                  }`}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-[10px] font-medium whitespace-nowrap">{item.name}</span>
                </Link>
              );
            })}
          </div>

          {/* Sponsors Link */}
          <Link
            href="/sponsors"
            className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 transition-colors rounded-lg hover:bg-orange-50 ml-1 ${
              pathname === "/sponsors" ? "text-orange-500 bg-orange-50" : "text-gray-600 hover:text-orange-500"
            }`}
          >
            <Building2 size={18} />
            <span className="text-[10px] font-medium whitespace-nowrap">スポンサー</span>
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden pb-16">{children}</main>

      {/* Footer Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-black text-white">
        <div className="flex items-center justify-around px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-12 h-10 hover:bg-white/10 rounded transition-colors"
          >
            <ArrowLeft size={22} />
          </button>
          <button
            onClick={() => window.history.forward()}
            className="flex items-center justify-center w-12 h-10 hover:bg-white/10 rounded transition-colors"
          >
            <ArrowRight size={22} />
          </button>
          <button
            onClick={() => router.refresh()}
            className="flex items-center justify-center w-12 h-10 hover:bg-white/10 rounded transition-colors"
          >
            <RefreshCw size={22} />
          </button>
          <button className="flex items-center justify-center w-12 h-10 hover:bg-white/10 rounded transition-colors">
            <Share2 size={22} />
          </button>
          <button className="flex items-center justify-center w-12 h-10 hover:bg-white/10 rounded transition-colors">
            <Menu size={22} />
          </button>
        </div>
      </div>

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
