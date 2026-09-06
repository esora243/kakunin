import { normalizeExternalHttpsUrl } from "@/lib/security/url";

/**
 * スポンサー枠の設定。
 *
 * 以前は `https://example.com/sponsor/...` の架空スポンサー (実在しない社名・日付) が
 * 本番で `target="_blank"` の実リンクとして配信されていた。
 * ここでは環境変数から実設定を読み、**設定が無ければ枠自体を描画しない**。
 * ダミーを出すくらいなら出さない、が方針。
 *
 * 1 ルートにつきスポンサー枠は最大 1 つ。本文中への差し込みは行わない。
 */
export type SponsorPlacementKey = "school" | "jobs" | "activities" | "contents";

export type SponsorSlot = {
  href: string;
  name: string;
  description: string;
  /** 景品表示法上の広告表記。既定は「PR」。 */
  badge: string;
};

function readSlot(
  href: string | undefined,
  name: string | undefined,
  description: string | undefined,
): SponsorSlot | null {
  const url = normalizeExternalHttpsUrl(href);
  const label = name?.trim();
  if (!url || !label) return null;
  return {
    href: url,
    name: label,
    description: description?.trim() ?? "",
    badge: "PR",
  };
}

// process.env.NEXT_PUBLIC_* はビルド時に静的置換されるため、キーは直接書く必要がある。
export const sponsorSlots: Record<SponsorPlacementKey, SponsorSlot | null> = {
  school: readSlot(
    process.env.NEXT_PUBLIC_SPONSOR_SCHOOL_URL,
    process.env.NEXT_PUBLIC_SPONSOR_SCHOOL_NAME,
    process.env.NEXT_PUBLIC_SPONSOR_SCHOOL_DESCRIPTION,
  ),
  jobs: readSlot(
    process.env.NEXT_PUBLIC_SPONSOR_JOBS_URL,
    process.env.NEXT_PUBLIC_SPONSOR_JOBS_NAME,
    process.env.NEXT_PUBLIC_SPONSOR_JOBS_DESCRIPTION,
  ),
  activities: readSlot(
    process.env.NEXT_PUBLIC_SPONSOR_ACTIVITIES_URL,
    process.env.NEXT_PUBLIC_SPONSOR_ACTIVITIES_NAME,
    process.env.NEXT_PUBLIC_SPONSOR_ACTIVITIES_DESCRIPTION,
  ),
  contents: readSlot(
    process.env.NEXT_PUBLIC_SPONSOR_CONTENTS_URL,
    process.env.NEXT_PUBLIC_SPONSOR_CONTENTS_NAME,
    process.env.NEXT_PUBLIC_SPONSOR_CONTENTS_DESCRIPTION,
  ),
};

export function getSponsorSlot(placement: SponsorPlacementKey): SponsorSlot | null {
  return sponsorSlots[placement];
}
