"use client";

import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";

/**
 * LineFollowFloating
 * - 全画面共通で右下に常駐する LINE 公式アカウント友だち追加ボタン。
 * - モバイルでも邪魔にならないよう、初回 8 秒経過後に小さくフェードイン。
 * - X ボタンで一時的に閉じられる（再表示はリロード時）。
 *
 * 環境変数:
 *   NEXT_PUBLIC_LINE_ADD_FRIEND_URL : 友だち追加用 URL（例: https://lin.ee/xxxxxxx）
 */
export function LineFollowFloating() {
  const [visible, setVisible] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, []);

  if (closed) return null;

  const lineUrl = process.env.NEXT_PUBLIC_LINE_ADD_FRIEND_URL || "https://line.me/";

  return (
    <div
      className={`fixed z-40 right-3 bottom-20 sm:bottom-6 transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      <div className="relative">
        <a
          href={lineUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full bg-[#06C755] text-white shadow-lg hover:shadow-xl hover:bg-[#05b34c] transition-all active:scale-95"
          aria-label="公式LINE 友だち追加"
        >
          <span className="w-7 h-7 rounded-full bg-white text-[#06C755] flex items-center justify-center font-bold text-sm shadow-sm">
            <MessageCircle size={16} strokeWidth={2.5} />
          </span>
          <span className="text-xs font-bold tracking-wide whitespace-nowrap">
            公式LINE 友だち追加
          </span>
        </a>

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setClosed(true);
          }}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center text-gray-500 hover:text-gray-700"
          aria-label="閉じる"
        >
          <X size={11} />
        </button>
      </div>
    </div>
  );
}
