-- IA-aligned backend domains for activities, contents, account-backed saves,
-- and contextual inquiries.

begin;

create table if not exists activity_kinds (
  code text primary key,
  name text not null unique,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  kind text not null references activity_kinds(code),
  title text not null,
  host_name text not null,
  summary text,
  description_md text,
  action_type text not null check (action_type in ('apply', 'signup', 'join', 'attend', 'inquire')),
  action_url text,
  target_audience text,
  location_pref text,
  location_detail text,
  starts_at timestamptz,
  ends_at timestamptz,
  deadline_at timestamptz,
  capacity_display text,
  requirements_json jsonb not null default '[]'::jsonb,
  benefits_json jsonb not null default '[]'::jsonb,
  source_name text,
  source_url text,
  source_last_modified_at timestamptz,
  synced_at timestamptz not null default now(),
  published_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (action_url is null or action_url ~* '^https://'),
  check (source_url is null or source_url ~* '^https://'),
  check (jsonb_typeof(requirements_json) = 'array'),
  check (jsonb_typeof(benefits_json) = 'array')
);

create table if not exists content_categories (
  code text primary key,
  name text not null unique,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  content_type text not null check (content_type in ('article', 'guide', 'story', 'sponsor_story', 'faq')),
  category text not null references content_categories(code),
  title text not null,
  dek text,
  body_md text,
  hero_image_url text,
  author_or_source text,
  related_activity_id uuid references activities(id),
  related_job_id uuid references jobs(id),
  source_name text,
  source_url text,
  source_last_modified_at timestamptz,
  synced_at timestamptz not null default now(),
  published_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (hero_image_url is null or hero_image_url ~* '^https://'),
  check (source_url is null or source_url ~* '^https://')
);

create table if not exists job_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create table if not exists activity_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, activity_id)
);

create table if not exists content_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  content_id uuid not null references contents(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, content_id)
);

create table if not exists inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  intent text not null check (intent in ('job', 'activity', 'content', 'school_career', 'sponsor_partner', 'problem_report', 'other')),
  job_id uuid references jobs(id),
  activity_id uuid references activities(id),
  content_id uuid references contents(id),
  message text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(message)) between 1 and 4000)
);

insert into job_bookmarks (user_id, job_id, created_at)
select user_id, job_id, created_at
from bookmarks
where content_type = 'job'
on conflict (user_id, job_id) do nothing;

insert into activity_kinds (code, name, display_order)
values
  ('program', 'プログラム', 10),
  ('event', 'イベント', 20),
  ('group', '学生団体', 30),
  ('volunteer', 'ボランティア', 40),
  ('study_abroad', '留学', 50),
  ('campaign', 'キャンペーン', 60)
on conflict (code) do nothing;

insert into content_categories (code, name, display_order)
values
  ('study', '学習', 10),
  ('career', 'キャリア', 20),
  ('guide', 'ガイド', 30),
  ('story', 'ストーリー', 40),
  ('sponsor', 'スポンサー', 50),
  ('faq', 'FAQ', 60)
on conflict (code) do nothing;

create index if not exists activities_kind_idx on activities(kind);
create index if not exists activities_active_published_idx on activities(is_active, published_at);
create index if not exists activities_deadline_idx on activities(deadline_at) where deadline_at is not null;
create index if not exists contents_category_idx on contents(category);
create index if not exists contents_type_idx on contents(content_type);
create index if not exists contents_active_published_idx on contents(is_active, published_at);
create index if not exists job_bookmarks_user_idx on job_bookmarks(user_id);
create index if not exists job_bookmarks_job_idx on job_bookmarks(job_id);
create index if not exists activity_bookmarks_user_idx on activity_bookmarks(user_id);
create index if not exists activity_bookmarks_activity_idx on activity_bookmarks(activity_id);
create index if not exists content_bookmarks_user_idx on content_bookmarks(user_id);
create index if not exists content_bookmarks_content_idx on content_bookmarks(content_id);
create index if not exists inquiries_user_idx on inquiries(user_id);
create index if not exists inquiries_status_idx on inquiries(status);
create index if not exists inquiries_activity_idx on inquiries(activity_id) where activity_id is not null;
create index if not exists inquiries_content_idx on inquiries(content_id) where content_id is not null;
create index if not exists inquiries_job_idx on inquiries(job_id) where job_id is not null;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'activity_kinds_updated_at') then
    create trigger activity_kinds_updated_at before update on activity_kinds for each row execute function preserve_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'activities_updated_at') then
    create trigger activities_updated_at before update on activities for each row execute function preserve_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'content_categories_updated_at') then
    create trigger content_categories_updated_at before update on content_categories for each row execute function preserve_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'contents_updated_at') then
    create trigger contents_updated_at before update on contents for each row execute function preserve_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'inquiries_updated_at') then
    create trigger inquiries_updated_at before update on inquiries for each row execute function preserve_updated_at();
  end if;
end;
$$;

grant select on activity_kinds, content_categories to hugmeid_app;
grant select on activities, contents to hugmeid_app;
grant select, insert, delete on job_bookmarks, activity_bookmarks, content_bookmarks to hugmeid_app;
grant select, insert, update on inquiries to hugmeid_app;

commit;
