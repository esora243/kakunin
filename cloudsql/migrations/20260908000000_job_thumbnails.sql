-- 求人 (jobs) にサムネイル画像列を追加。
-- contents / activities と同じ運用: 管理画面の /admin/api/assets/upload で
-- アップロードされた公開アセットURL（https のみ）を保存する。
-- 公開アプリ側の表示には既存の published_at / is_active のみで影響しない。

alter table public.jobs
  add column if not exists thumbnail_image_url text;

alter table public.jobs
  add constraint jobs_thumbnail_image_url_check
  check (thumbnail_image_url is null or thumbnail_image_url ~* '^https://');

alter table public.jobs validate constraint jobs_thumbnail_image_url_check;

grant select on public.jobs to hugmeid_public_runtime;
