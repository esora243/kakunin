"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useState } from "react";

/**
 * FloatingBanner
 * - TestAPP のヘッダー直下フローティング広告バナー (ネイビー #1E3A8A + F2F4F8/amber-50 グラデ)
 * - 閉じるボタンでその画面ではセッション中非表示。
 */
export type FloatingBannerProps = {
  campaignId: string;
  title: string;
  imageUrl: string;
  sponsorName: string;
};

export function FloatingBanner({
  campaignId,
  title,
  imageUrl,
  sponsorName,
}: FloatingBannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="relative mx-4 mb-3 animate-slide-in-top">
      <Link
        href={`/campaign/${campaignId}`}
        className="block relative w-full rounded-xl overflow-hidden shadow-md group cursor-pointer border border-[#B9C2DB] bg-white"
      >
        <div className="relative h-20 bg-gradient-to-r from-[#F2F4F8] to-amber-50">
          <img
            src={imageUrl}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-transparent flex items-center px-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-[#1E3A8A]/95 text-white text-[9px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
                  PR
                </span>
                <span className="text-white/90 text-[10px] font-medium truncate">
                  {sponsorName}
                </span>
              </div>
              <h3 className="text-white font-bold text-sm leading-tight line-clamp-2">
                {title}
              </h3>
            </div>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsVisible(false);
          }}
          aria-label="広告を閉じる"
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors"
        >
          <X size={14} />
        </button>
      </Link>
    </div>
  );
}
