-- Per-asset thumbnails for public Contents and Activities, plus admin-managed
-- per-university timetable entries. Image upload, soft-delete and variant rules
-- already enforce safe handling; this migration only widens the surface area
-- used by the admin app and the public UI.

-- 1. Activities: add a thumbnail column whose value is a managed public asset
-- URL (or NULL when the activity has no managed image). The CHECK mirrors the
-- existing contents_hero_image_url_check so the same upload pipeline and
-- validation rules govern both surfaces.
alter table public.activities
  add column thumbnail_image_url text;

alter table public.activities
  add constraint activities_thumbnail_image_url_check
  check (thumbnail_image_url is null or thumbnail_image_url ~* '^https://')
  not valid;
alter table public.activities validate constraint activities_thumbnail_image_url_check;

-- 2. Contents: an explicit thumbnail_image_url alongside the long-standing
-- hero_image_url. The thumbnail is what the public list surfaces (16:9,
-- 320/640/1280 webp/avif variants); the hero continues to back the detail
-- page and OG/Twitter cards.
alter table public.contents
  add column thumbnail_image_url text;

alter table public.contents
  add constraint contents_thumbnail_image_url_check
  check (thumbnail_image_url is null or thumbnail_image_url ~* '^https://')
  not valid;
alter table public.contents validate constraint contents_thumbnail_image_url_check;

-- 3. Per-university, per-academic-year, per-term admin timetable table. This
-- is independent from user_timetable_entries (which is the personalised
-- syllabus mapped onto a logged-in student). Admin users curate the official
-- timetable that users then opt into.
create table if not exists public.admin_university_timetable_entries (
  id uuid default gen_random_uuid() primary key,
  university_id uuid not null references public.universities(id) on delete cascade,
  academic_year integer not null check (academic_year between 2000 and 2100),
  term_number smallint not null check (term_number between 1 and 4),
  department_label text not null check (btrim(department_label) <> ''),
  class_title text not null check (btrim(class_title) <> ''),
  day_of_week text not null check (day_of_week in ('月','火','水','木','金','土')),
  period smallint not null check (period between 1 and 7),
  room text,
  instructor text,
  note text,
  source_url text check (source_url is null or source_url ~* '^https://'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by_admin_id uuid references public.admin_users(id),
  updated_by_admin_id uuid references public.admin_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (university_id, academic_year, term_number, department_label, class_title, day_of_week, period)
);
create index if not exists admin_university_timetable_lookup_idx
  on public.admin_university_timetable_entries (university_id, academic_year, term_number, day_of_week, period)
  where is_active;
create trigger admin_university_timetable_entries_updated_at
  before update on public.admin_university_timetable_entries
  for each row execute function public.preserve_updated_at();

-- 4. Privileges: public reads thumbnails for published items; admin runtime
-- writes admin_university_timetable_entries.
grant select on public.admin_university_timetable_entries to hugmeid_public_runtime;
grant select, insert, update, delete on public.admin_university_timetable_entries to hugmeid_admin_runtime;
