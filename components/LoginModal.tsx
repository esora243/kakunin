"use client";

import { X } from "lucide-react";
import { siteConfig } from "@/lib/site";

/**
 * LoginModal
 * - Hugmeid mock のデザイン準拠:
 *   1) 上部白パネル + オレンジリング H ロゴ
 *   2) 下部 orange-50/50 パネル + LINE 緑 (#06C755) CTA
 * - LINE LIFF / LINE OAuth のリンクを設定可能(siteConfig.lineLoginUrl)。
 */
type LoginModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
};

export function LoginModal({ isOpen, onClose, onLogin }: LoginModalProps) {
  if (!isOpen) return null;

  const handleLogin = () => {
    if (siteConfig.lineLoginUrl) {
      window.open(siteConfig.lineLoginUrl, "_blank", "noopener,noreferrer");
    }
    onLogin();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl">
        <div className="relative pt-6 pb-4 px-6 text-center border-b border-gray-100">
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>

          {/* グラデーションHロゴ (Hugmeid mock 準拠) */}
          <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-3 bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-sm">
            <span className="font-bold text-xl">H</span>
          </div>
          <h2 className="text-xl font-bold text-gray-800">ログインが必要です</h2>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            保存機能や応募、詳細なコンテンツの閲覧にはLINE連携ログインが必要です。
          </p>
        </div>

        <div className="p-6 bg-orange-50/50">
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-[#06C755] hover:bg-[#05B34C] text-white py-3.5 px-4 rounded-xl font-semibold shadow-sm transition-all active:scale-[0.98]"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M22.5 10.4c0-4.4-4.5-8-10.1-8-5.6 0-10.2 3.6-10.2 8 0 4 3.7 7.4 8.7 7.9.3.1.8.3.9.7.1.3-.1 1.2-.2 1.4-.1.3-.4 1.4 1 1s4.5-2.7 6.4-4.8c2.2-2.3 3.5-4.4 3.5-6.2z" />
            </svg>
            LINEでログイン・登録
          </button>

          {!siteConfig.lineLoginUrl && (
            <p className="text-xs text-center text-amber-600 mt-3">
              現在はデモログインとして動作します。実運用時は <code>NEXT_PUBLIC_LINE_LOGIN_URL</code> を設定してください。
            </p>
          )}

          <p className="text-xs text-center text-gray-400 mt-4">
            登録することで、利用規約とプライバシーポリシーに
            <br />
            同意したものとみなされます。
          </p>
        </div>
      </div>
    </div>
  );
}
