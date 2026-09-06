"use client";

import { MessageCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { normalizeExternalHttpsUrl } from "@/lib/security/url";

/**
 * アプリ自身の LINE 導線。1 画面に出る常設プロモーションはこれ 1 つだけにする。
 * リンクと閉じるをピル内で分割し、どちらも 44px のタップ領域を持たせている。
 */
export function LineFollowFloating() {
  const [visible, setVisible] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, []);

  const lineUrl = normalizeExternalHttpsUrl(process.env.NEXT_PUBLIC_LINE_ADD_FRIEND_URL);
  if (closed || !lineUrl) return null;

  return (
    <div
      className={`fixed bottom-browser-fab right-3 z-40 transition-all duration-500 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <div className="flex items-center rounded-pill bg-line text-inverse shadow-raised">
        <a
          href={lineUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-tap items-center gap-2 rounded-l-pill py-2 pl-3 pr-2 transition-colors hover:bg-line-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          aria-label="公式LINE 友だち追加"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-pill bg-surface-card text-line shadow-card">
            <MessageCircle size={16} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <span className="whitespace-nowrap text-caption font-bold tracking-wide">公式LINE 友だち追加</span>
        </a>
        <span className="h-6 w-px bg-white/30" aria-hidden="true" />
        <button
          type="button"
          onClick={() => setClosed(true)}
          aria-label="公式LINEの案内を閉じる"
          className="flex min-h-tap min-w-tap items-center justify-center rounded-r-pill transition-colors hover:bg-line-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
