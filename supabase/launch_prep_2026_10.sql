-- ============================================================
-- Launch prep (applied 2026-10-26/27 as cleanup_test_data_2026_10_27,
-- samples_business_codes_uploads, samples_not_open, invite_code_message).
-- ============================================================

-- ---------- 1. Test data removed (a private copy is kept in schema "archive", not exposed to the API) ----------
-- Clubs: cat club, dog club, fish club, bio, Bio, RC Club. Businesses: "Boba" and "boba" (duplicates of the sample Boba Time).
-- Their members, chat, reviews, promotions, verification requests and partnership rows went with them.
-- Backup tables: archive.clubs_20261027, archive.club_members_20261027, archive.club_chat_20261027,
--                archive.businesses_20261027, archive.business_promotions_20261027, archive.partner_agreements_20261027

-- ---------- 2. Sample listings ----------
alter table public.businesses add column if not exists is_sample boolean not null default false;
grant select (is_sample) on public.businesses to anon, authenticated;
update public.businesses set is_sample = true
 where owner_email is null and name in ('Boba Time', 'Peninsula Print Shop', 'Cove Athletics Co.', 'The Study Loft', 'Harbor Lanes');
update public.clubs set data = data || '{"sample": true}'::jsonb
 where id in ('c-med', 'c-robotics', 'c-code', 'c-biz', 'c-art', 'c-debate', 'c-green', 'c-track');
-- samples can never receive partnership requests
create or replace function public._entity_open(t text, eid text) returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(case when t = 'club' then (select data->>'partnershipOpen' = 'true' and coalesce(data->>'sample', 'false') <> 'true' from clubs where id = eid)
                       when t = 'business' then (select partnership_open and not is_sample from businesses where id::text = eid) end, false) $$;

-- ---------- 3. Businesses need a single-use invite code to publish (same pool as clubs) ----------
alter table public.businesses add column if not exists invite_code text;   -- only on the way in; the trigger clears it
create or replace function public._consume_invite_code(p_code text, p_kind text, p_id text, p_name text, p_public_id text) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  update invite_codes set used_kind = p_kind, used_id = p_id, used_name = p_name, used_public_id = p_public_id, used_by = my_member_id(), used_at = now()
   where upper(code) = upper(trim(coalesce(p_code, ''))) and active and used_at is null;
  if not found then raise exception 'That invite code isn''t valid (or it was already used).'; end if;
end $$;
create or replace function public.trg_business_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if not is_end_user() or is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.verified := false; new.rating := 0; new.review_count := 0; new.is_sample := false;
    if not legacy_writes_on() and lower(coalesce(new.owner_email, '')) is distinct from lower(coalesce(auth.email(), '')) then
      raise exception 'Log in with the email you''re listing the business under.'; end if;
    if not legacy_writes_on() then
      perform _consume_invite_code(new.invite_code, 'business', new.id::text, new.name, new.public_id);
    end if;
    new.invite_code := null;
    return new;
  end if;
  new.verified := old.verified; new.rating := old.rating; new.review_count := old.review_count; new.is_sample := old.is_sample;
  new.invite_code := null;
  if not legacy_writes_on() then new.owner_email := old.owner_email; end if;
  return new;
end $$;
-- clubs: only an admin can mark (or unmark) a club as a sample
create or replace function public.trg_clubs_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if not is_end_user() or is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    if not legacy_writes_on() then
      if my_member_id() is null or new.data->>'verifiedOwner' is distinct from my_member_id() then
        raise exception 'You can only create a club that you lead.'; end if;
      perform _consume_invite_code(new.data->>'inviteCode', 'club', new.id, new.data->>'name', new.data->>'clubId');
    end if;
    new.data := (new.data - 'inviteCode' - 'sample') || jsonb_build_object('verified', false);
    return new;
  end if;
  new.data := new.data - 'inviteCode' - 'sample';
  if old.data ? 'sample' then new.data := new.data || jsonb_build_object('sample', old.data->'sample'); end if;
  new.data := jsonb_set(new.data, '{verified}', coalesce(old.data->'verified', 'false'::jsonb));
  if not legacy_writes_on() then
    if (new.data->'verifiedOwner') is distinct from (old.data->'verifiedOwner') and not is_club_owner(old.id) then
      raise exception 'Only the President can hand off the club.'; end if;
    if (new.data->'banned_members') is distinct from (old.data->'banned_members') and not is_club_owner(old.id) then
      raise exception 'Only the President can ban members.'; end if;
  end if;
  return new;
end $$;

-- ---------- 4. Business photo / video uploads ----------
-- Files go to biz/<business id>/<file>; only that business's owner can add them, and only images / videos.
drop policy if exists "signed-in users upload business media" on storage.objects;
drop policy if exists "owners upload business media" on storage.objects;
create policy "owners upload business media" on storage.objects for insert to authenticated
  with check (bucket_id = 'business-media' and (storage.foldername(name))[1] = 'biz' and owns_business((storage.foldername(name))[2]));
update storage.buckets set allowed_mime_types = array['image/jpeg','image/png','image/gif','image/webp','image/heic','image/heif','video/mp4','video/webm','video/ogg','video/quicktime'],
  file_size_limit = 52428800 where id = 'business-media';
