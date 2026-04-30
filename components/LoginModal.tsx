"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { useAuth } from "@/components/AuthContext";

type LoginModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const router = useRouter();
  const { loginWithLine } = useAuth();
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async () => {
    try {
      setLoading(true);

      if (env.enableDevLogin && !env.lineLiffId()) {
        const result = await loginWithLine({ devLogin: true });
        toast.success("開発用ログインが完了しました");
        if (result.needsOnboarding) router.push("/register");
        return;
      }

      const liffModule = await import("@line/liff");
      const liff = liffModule.default;
      const liffId = env.lineLiffId();

      if (!liffId) {
        throw new Error("LIFF ID is not configured");
      }

      await liff.init({ liffId });
      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: window.location.href });
        return;
      }

      const profile = await liff.getProfile().catch(() => null);
      const result = await loginWithLine({
        idToken: liff.getIDToken() || undefined,
        accessToken: liff.getAccessToken() || undefined,
        profile: {
          displayName: profile?.displayName,
        },
      });

      toast.success("LINEでログインしました");
      if (result.needsOnboarding) {
        router.push("/register");
      }
    } catch (error) {
      console.error(error);
      toast.error("LINEログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl">
        <div className="relative pt-6 pb-4 px-6 text-center border-b border-gray-100">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
          <div className="w-12 h-12 bg-orange-100 text-orange-500 rounded-full mx-auto flex items-center justify-center mb-3">
            <span className="font-bold text-xl">H</span>
          </div>
          <h2 className="text-xl font-bold text-gray-800">ログインが必要です</h2>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            保存機能や応募、詳細なコンテンツの閲覧にはLINEログインが必要です。
          </p>
        </div>

        <div className="p-6 bg-orange-50/50">
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-[#06C755] hover:bg-[#05B34C] disabled:opacity-70 text-white py-3.5 px-4 rounded-xl font-semibold shadow-sm transition-all active:scale-[0.98]"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M22.5 10.4c0-4.4-4.5-8-10.1-8-5.6 0-10.2 3.6-10.2 8 0 4 3.7 7.4 8.7 7.9.3.1.8.3.9.7.1.3-.1 1.2-.2 1.4-.1.3-.4 1.4 1 1s4.5-2.7 6.4-4.8c2.2-2.3 3.5-4.4 3.5-6.2z" />
            </svg>
            {loading ? "ログイン中..." : "LINEでログイン・登録"}
          </button>

          {env.enableDevLogin && !env.lineLiffId() && (
            <p className="text-xs text-center text-amber-600 mt-3">
              NEXT_PUBLIC_ENABLE_DEV_LOGIN=true のため、LIFF未設定時は開発用ログインで動作します。
            </p>
          )}

          <p className="text-xs text-center text-gray-400 mt-4">
            登録することで、利用規約とプライバシーポリシーに<br />同意したものとみなされます。
          </p>
        </div>
      </div>
    </div>
  );
}
