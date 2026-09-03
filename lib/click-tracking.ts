import "server-only";

import { dbQuery } from "./db/postgres";

/**
 * 記事・広告のクリックカウント集計。
 * 記事は contents.click_count をインクリメントし、広告（スポンサー枠）は
 * sponsor_click_counts テーブルで配置ごとに集計する。
 */

export async function recordContentClick(contentId: string): Promise<boolean> {
  const result = await dbQuery(
    `update contents set click_count = click_count + 1 where id = $1::uuid`,
    [contentId],
  );
  return result.rowCount > 0;
}

export async function recordSponsorClick(placement: string, href: string): Promise<boolean> {
  const result = await dbQuery(
    `insert into sponsor_click_counts (placement, href, click_count, last_clicked_at)
     values ($1, $2, 1, now())
     on conflict (placement)
     do update set
       click_count = sponsor_click_counts.click_count + 1,
       href = excluded.href,
       last_clicked_at = now()`,
    [placement, href],
  );
  return result.rowCount > 0;
}
