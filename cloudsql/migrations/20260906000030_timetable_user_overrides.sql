-- 【M030】 ユーザー単位の時間割上書き（マスタを書き換えない編集機能）
create table if not exists public.timetable_user_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  syllabus_class_entry_id uuid not null references public.syllabus_class_entries(id) on delete cascade,
  override_kind text not null check (override_kind in ('replace','delete','note')),
  override_schedule jsonb,
  override_room text,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_tuo_user_class_active
  on public.timetable_user_overrides(user_id, syllabus_class_entry_id)
  where is_active = true;

create index ix_tuo_user on public.timetable_user_overrides(user_id);
