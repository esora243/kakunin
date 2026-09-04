-- ユーザー共同編集の共有時間割
-- ログイン済みユーザーが誰でも追加・編集・削除できる共有時間割テーブル。
-- 公開ページ（/school）に表示され、全ユーザーに共有される。

create table if not exists public.shared_timetable_entries (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id),
  academic_year integer not null,
  term_number integer not null,
  day_of_week text not null check (day_of_week in ('月', '火', '水', '木', '金', '土')),
  period integer not null check (period between 1 and 7),
  class_title text not null,
  instructor text,
  room text,
  note text,
  created_by_user_id uuid references public.users(id),
  updated_by_user_id uuid references public.users(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shared_timetable_entries_university_idx
  on public.shared_timetable_entries (university_id, academic_year, term_number, is_active);
