-- Immutable responsive image renditions owned by a logical asset.
-- Parent assets remain the preservation/source record; variants are served to
-- list/detail clients and are physically purged with the parent object.

alter table public.assets
  add constraint assets_object_path_not_variant
  check (object_path !~ '^contents/variants/') not valid;

alter table public.assets validate constraint assets_object_path_not_variant;

alter table public.assets
  add constraint assets_public_url_matches_object_path
  check (right(public_url, length('/api/assets/public/' || object_path)) = '/api/assets/public/' || object_path) not valid;

alter table public.assets validate constraint assets_public_url_matches_object_path;

alter table public.assets add constraint assets_id_bucket_unique unique (id, bucket);

create table public.asset_variants (
  id uuid default gen_random_uuid() primary key,
  asset_id uuid not null,
  bucket text not null check (btrim(bucket) <> ''),
  object_path text not null check (
    object_path ~ '^contents/variants/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/w[0-9]+\.(webp|avif)$'
  ),
  public_url text not null check (
    public_url ~ '^https://' and
    right(public_url, length('/api/assets/public/' || object_path)) = '/api/assets/public/' || object_path
  ),
  content_type text not null check (content_type in ('image/webp', 'image/avif')),
  width integer not null check (width between 1 and 12000),
  height integer not null check (height between 1 and 12000),
  byte_size bigint not null check (byte_size between 1 and 5242880),
  checksum text not null check (checksum ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (asset_id, content_type, width),
  unique (bucket, object_path),
  unique (public_url),
  foreign key (asset_id, bucket) references public.assets(id, bucket) on delete restrict
);

create function public.enforce_active_asset_variant_parent()
returns trigger
language plpgsql
as $$
declare
  parent_deleted_at timestamptz;
  parent_purged_at timestamptz;
begin
  select deleted_at, purged_at
    into parent_deleted_at, parent_purged_at
  from public.assets
  where id = new.asset_id and bucket = new.bucket
  for update;

  if not found then
    raise foreign_key_violation using message = 'asset variant parent does not exist in the same bucket';
  end if;
  if parent_deleted_at is not null or parent_purged_at is not null then
    raise check_violation using message = 'asset variants cannot be added to deleted or purged assets';
  end if;
  return new;
end;
$$;

revoke all privileges on function public.enforce_active_asset_variant_parent()
  from public, hugmeid_public_runtime, hugmeid_admin_runtime;

create trigger asset_variants_active_parent
before insert or update of asset_id, bucket on public.asset_variants
for each row execute function public.enforce_active_asset_variant_parent();

revoke all privileges on public.asset_variants from public, hugmeid_public_runtime, hugmeid_admin_runtime;
grant select, insert on public.asset_variants to hugmeid_admin_runtime;
