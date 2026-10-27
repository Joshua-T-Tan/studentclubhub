-- ============================================================
-- Verification questionnaire (applied 2026-10-27 as verification_questionnaire).
-- Owners now fill out a form (Page settings → Get verified → Request). The answers go in
-- verification_requests.details (only admins and the owner can read the row, per the existing RLS).
--   club:     fullName, email, school, schoolCity, schoolPhone, standing, advisorName, advisorEmail, [link]
--   business: fullName, role, email, phone, address, city, zip, bizPhone, [website], [listing]
--   both:     attest = true; the optional "anything else" text stays in `note`.
-- ============================================================
alter table public.verification_requests add column if not exists details jsonb;
-- one open request per club/business
create unique index if not exists verification_requests_one_pending on public.verification_requests (kind, entity_id) where status = 'pending';

create or replace function public.trg_verification_guard() returns trigger language plpgsql set search_path = public as $$
declare d jsonb := new.details; k text; req text[];
begin
  if not is_end_user() or is_admin() then return new; end if;
  if new.kind not in ('club', 'business') then raise exception 'Unknown listing type.'; end if;
  if d is null or jsonb_typeof(d) <> 'object' then raise exception 'Please fill out the verification form.'; end if;
  if length(d::text) > 6000 or length(coalesce(new.note, '')) > 1000 then raise exception 'That request is too long.'; end if;
  req := case when new.kind = 'club'
    then array['fullName','email','school','schoolCity','schoolPhone','standing','advisorName','advisorEmail']
    else array['fullName','role','email','phone','address','city','zip','bizPhone'] end;
  foreach k in array req loop
    if coalesce(trim(d->>k), '') = '' then raise exception 'Please answer every required question.'; end if;
  end loop;
  if coalesce(d->>'attest', '') <> 'true' then raise exception 'Please confirm the information is true.'; end if;
  if new.kind = 'club' and exists (select 1 from clubs where id = new.entity_id and data->>'sample' = 'true') then raise exception 'Sample listings can''t be verified.'; end if;
  if new.kind = 'business' and exists (select 1 from businesses where id::text = new.entity_id and is_sample) then raise exception 'Sample listings can''t be verified.'; end if;
  new.status := 'pending'; new.decided_at := null;
  new.requester_email := lower(coalesce(auth.email(), new.requester_email));
  return new;
end $$;
drop trigger if exists trg_verification_guard on public.verification_requests;
create trigger trg_verification_guard before insert on public.verification_requests for each row execute function public.trg_verification_guard();
