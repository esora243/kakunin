"use client";

import { Megaphone } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { getSponsorSlot, type SponsorPlacementKey } from "@/lib/sponsors";

/**
 * ヘッダー直下のスポンサー枠。
 *
 * - 実スポンサー設定 (環境変数) が無いときは **何も描画しない**。
 * - 全幅の帯だが、内容は Container で本文と同じ左右基準に揃える。
 *   以前は広告帯だけ内容が左端に寄り、PR 帯は中央寄せで揃っていなかった。
 * - 1 ルートにつき 1 枠。本文差し込み枠は廃止した。
 */
export function AdBanner({ placement }: { placement: SponsorPlacementKey }) {
  const slot = getSponsorSlot(placement);
  if (!slot) return null;

  return (
    <aside aria-label="スポンサー" className="border-b border-subtle bg-brand-50">
      <Container>
        <Link
          href={slot.href}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={() => {
            // 広告クリックを記録する。失敗しても遷移には影響させない。
            void fetch("/api/tracking/sponsor-click", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ placement, href: slot.href }),
              keepalive: true,
            }).catch(() => {});
          }}
          className="flex min-h-tap items-center gap-3 py-2.5 transition-colors hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Megaphone className="shrink-0 text-brand-700" size={20} aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-micro font-bold uppercase tracking-wider text-brand-700">{slot.badge}</span>
            <span className="block truncate text-body font-bold text-primary">{slot.name}</span>
            {slot.description ? (
              <span className="block truncate text-caption text-secondary">{slot.description}</span>
            ) : null}
          </span>
          <span className="shrink-0 text-caption font-bold text-brand-700 underline">詳細へ</span>
        </Link>
      </Container>
    </aside>
  );
}
