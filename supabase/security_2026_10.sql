-- ============================================================================
-- Real accounts + row-level security (2026-10-24)
-- Every account is a Supabase Auth user; the browser sends its access token, and
-- these policies decide who may change what. Reads stay public (it's a directory).
--
-- Rollout switch: app_settings.legacy_writes = 'on' keeps the old anonymous
-- writes working while the new site code deploys; flip it to 'off' right after:
--   update public.app_settings set value = 'off' where key = 'legacy_writes';
-- ============================================================================

create table if not exists public.app_settings (key text primary key, value text);
alter table public.app_settings enable row level security;
insert into public.app_settings values ('legacy_writes', 'on') on conflict (key) do nothing;

alter table public.profiles add column if not exists user_id uuid unique;

create table if not exists public.admins (email text primary key);
alter table public.admins enable row level security;
drop policy if exists "admins read self" on public.admins;
create policy "admins read self" on public.admins for select using (lower(email) = lower(coalesce(auth.email(), '')));
insert into public.admins values ('joshtanofficial@gmail.com') on conflict do nothing;

-- ---------- identity helpers (definer: they read tables the caller may not) ----------
create or replace function public.legacy_writes_on() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select value = 'on' from app_settings where key = 'legacy_writes'), false) $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from admins where lower(email) = lower(coalesce(auth.email(), ''))) $$;
create or replace function public.my_member_id() returns text language sql stable security definer set search_path = public as
$$ select member_id from profiles where user_id = auth.uid() limit 1 $$;
create or replace function public.is_club_owner(cid text) returns boolean language sql stable security definer set search_path = public as
$$ select my_member_id() is not null and (
     exists (select 1 from clubs where id = cid and data->>'verifiedOwner' = my_member_id())
  or exists (select 1 from club_members where club_id = cid and member_id = my_member_id() and role = 'President')) $$;
create or replace function public.is_club_officer(cid text) returns boolean language sql stable security definer set search_path = public as
$$ select is_club_owner(cid) or exists (select 1 from club_members where club_id = cid and member_id = my_member_id() and role <> 'Member') $$;
create or replace function public.is_club_member(cid text) returns boolean language sql stable security definer set search_path = public as
$$ select is_club_owner(cid) or exists (select 1 from club_members where club_id = cid and member_id = my_member_id()) $$;
create or replace function public.owns_business(bid text) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from businesses where id::text = bid and lower(owner_email) = lower(coalesce(auth.email(), ''))) $$;
create or replace function public.owns_entity(t text, eid text) returns boolean language sql stable security definer set search_path = public as
$$ select case when t = 'club' then is_club_owner(eid) when t = 'business' then owns_business(eid) else false end $$;
-- true for requests from the website (anon/authenticated); false inside trusted server functions
create or replace function public.is_end_user() returns boolean language sql stable as
$$ select current_user in ('anon', 'authenticated') $$;

-- ---------- invite codes: private, checked on the server ----------
create table if not exists public.invite_codes (code text primary key, active boolean not null default true, note text, created_at timestamptz default now());
alter table public.invite_codes enable row level security;
drop policy if exists "invite admin" on public.invite_codes;
create policy "invite admin" on public.invite_codes for all using (is_admin()) with check (is_admin());
-- the old codes were public in the site's JS (and git history), so they stay inactive
insert into public.invite_codes (code, active, note) values
  ('PVPHS2026', false, 'leaked: was in site JS'), ('WEST2026', false, 'leaked: was in site JS'), ('DEMO2026', false, 'leaked: was in site JS'),
  ('REDONDO2026', false, 'leaked: was in site JS'), ('MIRACOSTA2026', false, 'leaked: was in site JS'),
  ('SCH-2R9SQ6', true, 'created 2026-10-24'), ('SCH-4WEGH4', true, 'created 2026-10-24'), ('SCH-L329QU', true, 'created 2026-10-24')
on conflict (code) do nothing;
create or replace function public.check_invite_code(p_code text) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from invite_codes where upper(code) = upper(trim(coalesce(p_code, ''))) and active) $$;
grant execute on function public.check_invite_code(text) to anon, authenticated;

-- ---------- guard triggers (invoker: is_end_user() sees the real caller) ----------
create or replace function public.trg_clubs_guard() returns trigger language plpgsql as $$
begin
  if not is_end_user() or is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    if not legacy_writes_on() then
      if my_member_id() is null or new.data->>'verifiedOwner' is distinct from my_member_id() then
        raise exception 'You can only create a club that you lead.'; end if;
      if not check_invite_code(new.data->>'inviteCode') then
        raise exception 'That club leader invite code isn''t valid.'; end if;
    end if;
    new.data := (new.data - 'inviteCode') || jsonb_build_object('verified', false);
    return new;
  end if;
  new.data := new.data - 'inviteCode';
  new.data := jsonb_set(new.data, '{verified}', coalesce(old.data->'verified', 'false'::jsonb));   -- only an admin verifies
  if not legacy_writes_on() then
    if (new.data->'verifiedOwner') is distinct from (old.data->'verifiedOwner') and not is_club_owner(old.id) then
      raise exception 'Only the President can hand off the club.'; end if;
    if (new.data->'banned_members') is distinct from (old.data->'banned_members') and not is_club_owner(old.id) then
      raise exception 'Only the President can ban members.'; end if;
  end if;
  return new;
end $$;
drop trigger if exists clubs_guard on public.clubs;
create trigger clubs_guard before insert or update on public.clubs for each row execute function public.trg_clubs_guard();

create or replace function public.trg_club_members_guard() returns trigger language plpgsql as $$
begin
  if not is_end_user() or is_admin() or legacy_writes_on() then return new; end if;
  if tg_op = 'INSERT' then
    if new.member_id = my_member_id() then
      if exists (select 1 from clubs where id = new.club_id and coalesce(data->'banned_members', '[]'::jsonb) ? new.member_id) then
        raise exception 'You''ve been banned from this club.'; end if;
      if coalesce(new.role, 'Member') <> 'Member' and not is_club_owner(new.club_id) then new.role := 'Member'; end if;
    end if;
    return new;
  end if;
  if new.club_id is distinct from old.club_id or new.member_id is distinct from old.member_id then raise exception 'Not allowed.'; end if;
  if new.role is distinct from old.role and not is_club_owner(old.club_id) then raise exception 'Only the President can change roles.'; end if;
  return new;
end $$;
drop trigger if exists club_members_guard on public.club_members;
create trigger club_members_guard before insert or update on public.club_members for each row execute function public.trg_club_members_guard();

-- someone other than the author (an officer / business owner replying) may only change replies
create or replace function public.trg_review_guard() returns trigger language plpgsql as $$
begin
  if not is_end_user() or is_admin() or legacy_writes_on() then return new; end if;
  if old.author_id is distinct from my_member_id() then
    new.text := old.text; new.rating := old.rating; new.author := old.author;
  end if;
  new.author_id := old.author_id;
  return new;
end $$;
drop trigger if exists club_reviews_guard on public.club_reviews;
create trigger club_reviews_guard before update on public.club_reviews for each row execute function public.trg_review_guard();
drop trigger if exists biz_reviews_guard on public.biz_reviews;
create trigger biz_reviews_guard before update on public.biz_reviews for each row execute function public.trg_review_guard();

create or replace function public.trg_business_guard() returns trigger language plpgsql as $$
begin
  if not is_end_user() or is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.verified := false; new.rating := 0; new.review_count := 0;
    if not legacy_writes_on() and lower(coalesce(new.owner_email, '')) is distinct from lower(coalesce(auth.email(), '')) then
      raise exception 'Log in with the email you''re listing the business under.'; end if;
    return new;
  end if;
  new.verified := old.verified; new.rating := old.rating; new.review_count := old.review_count;
  if not legacy_writes_on() then new.owner_email := old.owner_email; end if;
  return new;
end $$;
drop trigger if exists businesses_guard on public.businesses;
create trigger businesses_guard before insert or update on public.businesses for each row execute function public.trg_business_guard();

-- ---------- policies: drop every old write policy, then add owner-scoped ones ----------
do $$ declare r record; begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and cmd <> 'SELECT'
    and tablename in ('clubs','club_members','club_chat','club_reviews','businesses','biz_reviews','partner_agreements','profiles',
                      'site_reviews','reports','contact_messages','conversations','messages','partner_links','partnerships','biz_connections')
  loop execute format('drop policy %I on public.%I', r.policyname, r.tablename); end loop;
end $$;
-- site_reviews had one "for all" policy; give it an explicit read policy (kept) and owner writes
drop policy if exists site_reviews_write on public.site_reviews;

create policy "clubs insert" on public.clubs for insert with check (legacy_writes_on() or my_member_id() is not null);
create policy "clubs update" on public.clubs for update using (legacy_writes_on() or is_club_officer(id));
create policy "clubs delete" on public.clubs for delete using (legacy_writes_on() or is_club_owner(id));

create policy "cm insert" on public.club_members for insert with check (legacy_writes_on() or member_id = my_member_id() or is_club_owner(club_id));
create policy "cm update" on public.club_members for update using (legacy_writes_on() or member_id = my_member_id() or is_club_owner(club_id));
create policy "cm delete" on public.club_members for delete using (legacy_writes_on() or member_id = my_member_id() or is_club_owner(club_id));

create policy "cc insert" on public.club_chat for insert with check (legacy_writes_on() or (sender_id = my_member_id() and is_club_member(club_id)));
create policy "cc update" on public.club_chat for update using (legacy_writes_on() or sender_id = my_member_id());
create policy "cc delete" on public.club_chat for delete using (legacy_writes_on() or is_club_owner(club_id));

create policy "cr insert" on public.club_reviews for insert with check (legacy_writes_on() or (author_id = my_member_id() and is_club_member(club_id)));
create policy "cr update" on public.club_reviews for update using (legacy_writes_on() or author_id = my_member_id() or is_club_officer(club_id));
create policy "cr delete" on public.club_reviews for delete using (legacy_writes_on() or author_id = my_member_id() or is_club_owner(club_id));

create policy "biz insert" on public.businesses for insert with check (legacy_writes_on() or lower(owner_email) = lower(coalesce(auth.email(), '')));
create policy "biz update" on public.businesses for update using (legacy_writes_on() or owns_business(id::text));
create policy "biz delete" on public.businesses for delete using (legacy_writes_on() or owns_business(id::text));

create policy "br insert" on public.biz_reviews for insert with check (legacy_writes_on() or (author_id = my_member_id() and not owns_business(business_id::text)));
create policy "br update" on public.biz_reviews for update using (legacy_writes_on() or author_id = my_member_id() or owns_business(business_id::text));
create policy "br delete" on public.biz_reviews for delete using (legacy_writes_on() or author_id = my_member_id());

create policy "pa insert" on public.partner_agreements for insert with check (legacy_writes_on() or owns_entity(a_type, a_id));
create policy "pa update" on public.partner_agreements for update using (legacy_writes_on() or owns_entity(a_type, a_id) or owns_entity(b_type, b_id));

create policy "prof insert" on public.profiles for insert with check (legacy_writes_on() or (user_id = auth.uid() and lower(email) = lower(coalesce(auth.email(), ''))));
create policy "prof update" on public.profiles for update
  using (legacy_writes_on() or user_id = auth.uid() or (user_id is null and lower(email) = lower(coalesce(auth.email(), ''))))
  with check (legacy_writes_on() or (user_id = auth.uid() and lower(email) = lower(coalesce(auth.email(), ''))));
create policy "prof delete" on public.profiles for delete using (legacy_writes_on() or user_id = auth.uid());

create policy "sr insert" on public.site_reviews for insert with check (legacy_writes_on() or author_id = my_member_id());
create policy "sr update" on public.site_reviews for update using (legacy_writes_on() or author_id = my_member_id());
create policy "sr delete" on public.site_reviews for delete using (legacy_writes_on() or author_id = my_member_id());

create policy "reports insert" on public.reports for insert with check (legacy_writes_on() or auth.uid() is not null);
create policy "contact insert" on public.contact_messages for insert with check (legacy_writes_on() or auth.uid() is not null);
-- conversations / messages / partner_links / partnerships / biz_connections are retired: read-only now.

-- uploads need an account
drop policy if exists "anyone uploads business media" on storage.objects;
drop policy if exists "signed-in users upload business media" on storage.objects;
create policy "signed-in users upload business media" on storage.objects for insert
  with check (bucket_id = 'business-media' and (public.legacy_writes_on() or auth.uid() is not null));

-- ---------- server functions ----------
-- Field-level club save: only the keys this editor changed are merged in, so two officers
-- editing different parts of the page at the same time don't overwrite each other.
create or replace function public.save_club(p_id text, p_patch jsonb, p_remove text[] default '{}') returns jsonb language plpgsql as $$
declare d jsonb;
begin
  update clubs set data = (data - coalesce(p_remove, '{}')) || coalesce(p_patch, '{}'::jsonb), updated_at = now() where id = p_id returning data into d;
  if d is null then raise exception 'You don''t have permission to edit this club (or it was deleted).'; end if;
  return d;
end $$;
grant execute on function public.save_club(text, jsonb, text[]) to anon, authenticated;

create or replace function public.delete_club(p_id text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not (is_club_owner(p_id) or is_admin() or legacy_writes_on()) then raise exception 'Only the President can delete this club.'; end if;
  update partner_agreements set status = 'ended' where status in ('pending', 'launched')
    and ((a_type = 'club' and a_id = p_id) or (b_type = 'club' and b_id = p_id));
  delete from club_members where club_id = p_id;
  delete from club_chat where club_id = p_id;
  delete from club_reviews where club_id = p_id;
  delete from verification_requests where kind = 'club' and entity_id = p_id;
  delete from clubs where id = p_id;
end $$;
grant execute on function public.delete_club(text) to anon, authenticated;

create or replace function public.delete_my_account() returns void language plpgsql security definer set search_path = public, auth as $$
declare mid text := my_member_id();
begin
  if auth.uid() is null then raise exception 'Please log in again.'; end if;
  if mid is not null and exists (select 1 from clubs where data->>'verifiedOwner' = mid) then
    raise exception 'Hand off the presidency or delete your clubs first.'; end if;
  if exists (select 1 from businesses where lower(owner_email) = lower(auth.email())) then
    raise exception 'Delete your business listing first.'; end if;
  if mid is not null then delete from club_members where member_id = mid; end if;
  delete from profiles where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end $$;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- verification requests (the seal is granted by an admin, not self-assigned) ----------
create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('club', 'business')),
  entity_id text not null, entity_name text, requester_id text, requester_email text, note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now(), decided_at timestamptz);
alter table public.verification_requests enable row level security;
drop policy if exists "vr read" on public.verification_requests;
drop policy if exists "vr insert" on public.verification_requests;
drop policy if exists "vr admin update" on public.verification_requests;
create policy "vr read" on public.verification_requests for select using (is_admin() or owns_entity(kind, entity_id));
create policy "vr insert" on public.verification_requests for insert with check (owns_entity(kind, entity_id) and status = 'pending' and requester_id = my_member_id());
create policy "vr admin update" on public.verification_requests for update using (is_admin());

create or replace function public.admin_decide_verification(p_req uuid, p_approve boolean) returns void language plpgsql security definer set search_path = public as $$
declare r verification_requests;
begin
  if not is_admin() then raise exception 'Admins only.'; end if;
  select * into r from verification_requests where id = p_req;
  if r.id is null then raise exception 'Request not found.'; end if;
  update verification_requests set status = case when p_approve then 'approved' else 'rejected' end, decided_at = now() where id = p_req;
  if p_approve then perform admin_set_verified(r.kind, r.entity_id, true); end if;
end $$;
create or replace function public.admin_set_verified(p_kind text, p_id text, p_on boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only.'; end if;
  if p_kind = 'club' then update clubs set data = jsonb_set(data, '{verified}', to_jsonb(p_on)), updated_at = now() where id = p_id;
  else update businesses set verified = p_on where id::text = p_id; end if;
end $$;
grant execute on function public.admin_decide_verification(uuid, boolean) to authenticated;
grant execute on function public.admin_set_verified(text, text, boolean) to authenticated;

-- ---------- one-time data fixes ----------
-- invite codes no longer live inside public club data
update public.clubs set data = data - 'inviteCode' where data ? 'inviteCode';
-- Joshua Tan had two member IDs for one email (#8825 original, #9892 made on a second browser): merge into #8825
update public.clubs set data = jsonb_set(data, '{verifiedOwner}', '"#8825"') where data->>'verifiedOwner' = '#9892';
delete from public.club_members a where member_id = '#9892' and exists (select 1 from public.club_members b where b.club_id = a.club_id and b.member_id = '#8825');
update public.club_members set member_id = '#8825' where member_id = '#9892';
update public.club_chat set sender_id = '#8825' where sender_id = '#9892';
update public.club_reviews set author_id = '#8825' where author_id = '#9892';
update public.biz_reviews set author_id = '#8825' where author_id = '#9892';
update public.site_reviews set author_id = '#8825' where author_id = '#9892';

-- Migration "admin_inbox_policies": admins read/resolve Contact Us messages and reports (Admin page).
create policy "contact admin read" on public.contact_messages for select using (is_admin());
create policy "contact admin update" on public.contact_messages for update using (is_admin()) with check (is_admin());
create policy "contact admin delete" on public.contact_messages for delete using (is_admin());
create policy "reports admin read" on public.reports for select using (is_admin());
create policy "reports admin update" on public.reports for update using (is_admin()) with check (is_admin());
create policy "reports admin delete" on public.reports for delete using (is_admin());

-- Migration "profile_types_public_fields": the one public profile version a member chose to display.
alter table public.profiles add column if not exists profile_type text not null default 'student'
  check (profile_type in ('student', 'business', 'community'));
alter table public.profiles add column if not exists headline text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists details jsonb not null default '{}'::jsonb;
