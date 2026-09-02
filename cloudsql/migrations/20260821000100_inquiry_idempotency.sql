alter table public.inquiries
  add column idempotency_key uuid,
  add column request_fingerprint text,
  add constraint inquiries_request_fingerprint_check
    check (request_fingerprint is null or length(request_fingerprint) = 64);

create unique index inquiries_user_idempotency_key_uidx
  on public.inquiries (user_id, idempotency_key)
  where idempotency_key is not null;
