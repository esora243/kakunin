-- 記事・広告のクリックカウント機能
-- 記事は contents.click_count で集計し、広告（スポンサー枠）は
-- sponsor_click_counts テーブルで配置ごとに集計する。

alter table public.contents
  add column if not exists click_count integer not null default 0;

create table if not exists public.sponsor_click_counts (
  placement text primary key,
  href text not null,
  click_count integer not null default 0,
  last_clicked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
