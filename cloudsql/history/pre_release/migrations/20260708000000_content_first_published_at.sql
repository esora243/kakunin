begin;

alter table contents add column if not exists first_published_at timestamptz;

update contents
set first_published_at = published_at
where first_published_at is null
  and published_at is not null;

create index if not exists contents_first_published_at_idx on contents(first_published_at);

commit;
