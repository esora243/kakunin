alter table public.jobs
  add constraint jobs_active_published_apply_url_required
  check (
    not is_active
    or published_at is null
    or (
      apply_url is not null
      and apply_url ~* '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?))*(:([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5]))?([/?#][^[:space:]]*)?$'
      and apply_url !~* '^https://[0-9]+([.][0-9]+)*([/:?#]|$)'
    )
  )
  not valid;
