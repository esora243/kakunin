"use client";

import Link from "next/link";

type AdBannerProps = {
  type: "header" | "footer" | "infeed";
  campaignId: string;
  title: string;
  imageUrl: string;
  sponsorName: string;
};

export function AdBanner({ type, campaignId, title, imageUrl, sponsorName }: AdBannerProps) {
  const heights = {
    header: "h-20",
    footer: "h-20",
    infeed: "h-32",
  };

  const containerClass = type === "infeed" ? "w-full max-w-lg mx-auto px-4" : "w-full";

  return (
    <div className={containerClass}>
      <Link
        href={`/campaign/${campaignId}`}
        className="block relative w-full rounded-xl overflow-hidden shadow-sm group cursor-pointer border border-pink-100"
      >
        <div className={`relative ${heights[type]} bg-gradient-to-r from-pink-50 to-rose-50`}>
          <img
            src={imageUrl}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/30 to-transparent flex items-center px-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-pink-500/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
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
