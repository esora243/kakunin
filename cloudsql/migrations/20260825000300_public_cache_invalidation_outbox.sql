create table public.public_cache_invalidation_jobs (
  id uuid default gen_random_uuid() primary key,
  actor_admin_id uuid not null references public.admin_users(id),
  resource_type text not null,
  resource_id text not null,
  tags text[] not null check (cardinality(tags) > 0),
  status text not null default 'pending' check (status in ('pending', 'complete')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  completed_at timestamp with time zone,
  check ((status = 'complete') = (completed_at is not null))
);

create index public_cache_invalidation_jobs_pending_idx
  on public.public_cache_invalidation_jobs (created_at, id) where status = 'pending';

grant select, insert, update on table public.public_cache_invalidation_jobs to hugmeid_admin_runtime;
