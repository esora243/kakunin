"use client";

import Link from "next/link";

/**
 * AdBanner
 * - 汎用広告バナー (header / footer / infeed)。
 * - Hugmeid mock のデザインに合わせ、orange-50 のグラデーション背景と
 *   PRバッジ / スポンサー名 / タイトルの3要素オーバーレイを採用。
 * - infeed は max-w-lg 中央寄せでフィード途中に挿入する想定。
 */
export type AdBannerProps = {
  type: "header" | "footer" | "infeed";
  campaignId: string;
  title: string;
  imageUrl: string;
  sponsorName: string;
};

const HEIGHT_MAP: Record<AdBannerProps["type"], string> = {
  header: "h-20",
  footer: "h-20",
  infeed: "h-32",
};

export function AdBanner({ type, campaignId, title, imageUrl, sponsorName }: AdBannerProps) {
  const containerClass = type === "infeed" ? "w-full max-w-lg mx-auto px-4" : "w-full";

  return (
    <div className={containerClass}>
      <Link
        href={`/campaign/${campaignId}`}
        className="block relative w-full rounded-xl overflow-hidden shadow-sm group cursor-pointer border border-orange-100"
      >
        <div className={`relative ${HEIGHT_MAP[type]} bg-gradient-to-r from-orange-50 to-orange-50`}>
          <img
            src={imageUrl}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/30 to-transparent flex items-center px-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-orange-500/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
                  PR
                </span>
                <span className="text-white/90 text-[10px] font-medium">{sponsorName}</span>
              </div>
              <h3 className="text-white font-bold text-sm leading-tight">{title}</h3>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
