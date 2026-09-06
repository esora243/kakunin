alter table admin_users add column if not exists deleted_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'admin_users_deleted_must_be_inactive'
  ) then
    alter table admin_users
      add constraint admin_users_deleted_must_be_inactive
      check (deleted_at is null or is_active = false);
  end if;
end;
$$;

create index if not exists admin_users_deleted_idx on admin_users(deleted_at);
