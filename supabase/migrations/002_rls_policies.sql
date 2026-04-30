alter table public.users enable row level security;
alter table public.organizations enable row level security;
alter table public.jobs enable row level security;
alter table public.bookmarks enable row level security;
alter table public.articles enable row level security;
alter table public.classes enable row level security;
alter table public.class_assignments enable row level security;
alter table public.class_assignment_completions enable row level security;
alter table public.class_user_settings enable row level security;

drop policy if exists "users can read own profile" on public.users;
create policy "users can read own profile"
  on public.users for select
  using (auth.uid() = id);

drop policy if exists "users can update own profile" on public.users;
create policy "users can update own profile"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "service role can insert users" on public.users;
create policy "service role can insert users"
  on public.users for insert
  with check (auth.role() = 'service_role');

drop policy if exists "published organizations are public" on public.organizations;
create policy "published organizations are public"
  on public.organizations for select
  using (is_published = true);

drop policy if exists "published jobs are public" on public.jobs;
create policy "published jobs are public"
  on public.jobs for select
  using (is_published = true);

drop policy if exists "published articles are public" on public.articles;
create policy "published articles are public"
  on public.articles for select
  using (is_published = true);

drop policy if exists "published classes are public" on public.classes;
create policy "published classes are public"
  on public.classes for select
  using (is_published = true);

drop policy if exists "published assignments are public" on public.class_assignments;
create policy "published assignments are public"
  on public.class_assignments for select
  using (is_published = true);

drop policy if exists "users can read own completions" on public.class_assignment_completions;
create policy "users can read own completions"
  on public.class_assignment_completions for select
  using (auth.uid() = user_id);

drop policy if exists "users can upsert own completions" on public.class_assignment_completions;
create policy "users can upsert own completions"
  on public.class_assignment_completions for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can delete own completions" on public.class_assignment_completions;
create policy "users can delete own completions"
  on public.class_assignment_completions for delete
  using (auth.uid() = user_id);

drop policy if exists "users can manage own class settings" on public.class_user_settings;
create policy "users can manage own class settings"
  on public.class_user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users can read own bookmarks" on public.bookmarks;
create policy "users can read own bookmarks"
  on public.bookmarks for select
  using (auth.uid() = user_id);

drop policy if exists "users can insert own bookmarks" on public.bookmarks;
create policy "users can insert own bookmarks"
  on public.bookmarks for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can delete own bookmarks" on public.bookmarks;
create policy "users can delete own bookmarks"
  on public.bookmarks for delete
  using (auth.uid() = user_id);
