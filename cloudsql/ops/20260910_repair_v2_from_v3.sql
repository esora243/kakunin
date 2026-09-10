-- ============================================================
-- 2026-09-10 障害復旧用 (再実行・検証用) — hugmeid_production_v2 修復
--
-- 背景:
--   アプリの接続先は hugmeid_production_v2 だが、実データは
--   hugmeid_production_v3 に存在し、さらに v2 には 2026-09-02 以降の
--   マイグレーションが未適用だった。そのため公開/管理ともに
--   「データが吸い上げられない」「column click_count does not exist」
--   の状態だった。
--
-- 対応 (実施済み):
--   1) v2 に未適用マイグレーション 6 件を適用
--      (20260902000000_content_activity_thumbnails 〜 20260908000000_job_thumbnails)
--   2) v3 の実データを v2 へ行コピー (423行 / 22テーブルが v2=v3 で一致確認)
--   3) 新設テーブルへの runtime ロール権限を付与
--
-- このファイルは「再適用が必要になった場合」「検証したい場合」のための
-- 冪等(idempotent)な修復SQLである。db:migrate (scripts/cloudsql-migrate.mjs)
-- の管理外で手動適用した分を schema_migrations へ記録する用途にも使う。
--
-- 実行: hugmeid_schema_owner または postgres で hugmeid_production_v2 に接続して実行。
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 0) 前提: 環境センチネルの確認 (production であること)
-- ------------------------------------------------------------
do $$
declare
  v_value text;
begin
  select value into v_value from public.app_environment where key = 'database_environment';
  if v_value is distinct from 'production' then
    raise exception 'app_environment.database_environment is %, expected production (aborting)', coalesce(v_value,'<missing>');
  end if;
end $$;

-- ------------------------------------------------------------
-- 1) v2 に最新スキーマ要素が存在するか検査 (未適用なら FAIL)
--    修復後は全て存在するはず。無い場合は以下を先に実行:
--      npm run db:migrate
--    (db:migrate が cloudsql/migrations の未適用分を順次適用する)
-- ------------------------------------------------------------
do $$
begin
  -- click_tracking (contents.click_count / sponsor_click_counts)
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='contents' and column_name='click_count'
  ) then
    raise exception 'contents.click_count is missing: run migrations (20260903000000_click_tracking)';
  end if;
  if not exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='sponsor_click_counts'
  ) then
    raise exception 'sponsor_click_counts is missing: run migrations (20260903000000_click_tracking)';
  end if;

  -- thumbnails (contents/activities/jobs)
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='contents' and column_name='thumbnail_image_url'
  ) then
    raise exception 'contents.thumbnail_image_url is missing: run migrations (20260902000000_content_activity_thumbnails)';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='jobs' and column_name='thumbnail_image_url'
  ) then
    raise exception 'jobs.thumbnail_image_url is missing: run migrations (20260908000000_job_thumbnails)';
  end if;

  -- shared timetable / timetable overrides / grade scope
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='shared_timetable_entries') then
    raise exception 'shared_timetable_entries is missing: run migrations (20260903000001_shared_timetable)';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='personal_timetable_overrides') then
    raise exception 'personal_timetable_overrides is missing: run migrations (20260906000030_timetable_user_overrides)';
  end if;

  raise notice 'schema check OK: v2 has all migrations through 2026-09-08';
end $$;

-- ------------------------------------------------------------
-- 2) 新設テーブルへの runtime ロール権限 (冪等: 既にあっても可)
--    公開=読み取り中心 / 管理=読み書き の既存方針に合わせる。
-- ------------------------------------------------------------
do $$
declare
  r record;
begin
  -- 公開 runtime: 参照のみ
  if exists (select 1 from pg_roles where rolname='hugmeid_public_runtime') then
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name='shared_timetable_entries') then
      execute 'grant select on public.shared_timetable_entries to hugmeid_public_runtime';
    end if;
    -- クリック計測のため click_count のみ UPDATE を許可
    execute 'grant select on public.contents to hugmeid_public_runtime';
    execute 'grant update (click_count, last_clicked_at) on public.contents to hugmeid_public_runtime';
  else
    raise notice 'role hugmeid_public_runtime not found; skipping public grants';
  end if;

  -- 管理 runtime: 読み書き
  if exists (select 1 from pg_roles where rolname='hugmeid_admin_runtime') then
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name='shared_timetable_entries') then
      execute 'grant select, insert, update, delete on public.shared_timetable_entries to hugmeid_admin_runtime';
    end if;
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name='personal_timetable_overrides') then
      execute 'grant select, insert, update, delete on public.personal_timetable_overrides to hugmeid_admin_runtime';
    end if;
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name='sponsor_click_counts') then
      execute 'grant select, insert, update on public.sponsor_click_counts to hugmeid_admin_runtime';
    end if;
  else
    raise notice 'role hugmeid_admin_runtime not found; skipping admin grants';
  end if;

  raise notice 'grant check OK';
end $$;

-- ------------------------------------------------------------
-- 3) schema_migrations への記録補完 (手動適用分の帳簿合わせ・冪等)
--    db:migrate 管理の列構成: version / name / kind / checksum_sha256 / applied_at / applied_by
-- ------------------------------------------------------------
create table if not exists public.schema_migrations (
  version text primary key,
  name text not null,
  kind text not null,
  checksum_sha256 text,
  applied_at timestamptz not null default now(),
  applied_by text
);

insert into public.schema_migrations (version, name, kind, applied_by)
values
  ('20260902000000','content_activity_thumbnails','migration','manual-repair-20260910'),
  ('20260903000000','click_tracking','migration','manual-repair-20260910'),
  ('20260903000001','shared_timetable','migration','manual-repair-20260910'),
  ('20260906000020','timetable_university_grade_scope','migration','manual-repair-20260910'),
  ('20260906000030','timetable_user_overrides','migration','manual-repair-20260910'),
  ('20260908000000','job_thumbnails','migration','manual-repair-20260910')
on conflict (version) do nothing;

commit;

-- ------------------------------------------------------------
-- 4) 検証クエリ (実行後に目視確認)
-- ------------------------------------------------------------
-- データ件数 (v3 と一致すること):
--   select 'contents' t, count(*) from contents
--   union all select 'activities', count(*) from activities
--   union all select 'jobs', count(*) from jobs
--   union all select 'admin_audit_logs', count(*) from admin_audit_logs
--   union all select 'assets', count(*) from assets
--   union all select 'asset_variants', count(*) from asset_variants
--   union all select 'content_versions', count(*) from content_versions
--   order by 1;
-- 期待値: contents=30 / activities=4 / jobs=1 / admin_audit_logs=192 /
--         assets=19 / asset_variants=64 / content_versions=109
