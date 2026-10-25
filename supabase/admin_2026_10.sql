-- ============================================================
-- Admin upgrades (applied 2026-10-25 as admin_codes_reports_v2 + reports_guard_fix):
--   * invite codes work ONCE and remember which club used them
--   * reports take the reporter from the login, record "where it happened",
--     and admins read them through admin_reports() (adds IDs + emails)
--   * live admin badge (reports / contact messages / verification requests in Realtime)
-- Final state; safe to re-run.
-- ============================================================

-- ===================== Invite codes: single use =====================
alter table public.invite_codes add column if not exists used_kind text check (used_kind in ('club', 'business'));
alter table public.invite_codes add column if not exists used_id text;
alter table public.invite_codes add column if not exists used_name text;
alter table public.invite_codes add column if not exists used_public_id text;
alter table public.invite_codes add column if not exists used_by text;          -- member ID of whoever used it
alter table public.invite_codes add column if not exists used_at timestamptz;

-- A code works once: it must be on AND not used yet.
create or replace function public.check_invite_code(p_code text) returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from invite_codes where upper(code) = upper(trim(coalesce(p_code, ''))) and active and used_at is null) $$;

-- Claim a code for a new club (atomic: two people racing for the same code can't both win).
create or replace function public._consume_invite_code(p_code text, p_kind text, p_id text, p_name text, p_public_id text) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  update invite_codes set used_kind = p_kind, used_id = p_id, used_name = p_name, used_public_id = p_public_id, used_by = my_member_id(), used_at = now()
   where upper(code) = upper(trim(coalesce(p_code, ''))) and active and used_at is null;
  if not found then raise exception 'That club leader invite code isn''t valid (or it was already used).'; end if;
end $$;
revoke execute on function public._consume_invite_code(text, text, text, text, text) from public, anon;
grant execute on function public._consume_invite_code(text, text, text, text, text) to authenticated;   -- called from the clubs trigger (runs as the user)

create or replace function public.trg_clubs_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if not is_end_user() or is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    if not legacy_writes_on() then
      if my_member_id() is null or new.data->>'verifiedOwner' is distinct from my_member_id() then
        raise exception 'You can only create a club that you lead.'; end if;
      perform _consume_invite_code(new.data->>'inviteCode', 'club', new.id, new.data->>'name', new.data->>'clubId');
    end if;
    new.data := (new.data - 'inviteCode') || jsonb_build_object('verified', false);
    return new;
  end if;
  new.data := new.data - 'inviteCode';
  new.data := jsonb_set(new.data, '{verified}', coalesce(old.data->'verified', 'false'::jsonb));
  if not legacy_writes_on() then
    if (new.data->'verifiedOwner') is distinct from (old.data->'verifiedOwner') and not is_club_owner(old.id) then
      raise exception 'Only the President can hand off the club.'; end if;
    if (new.data->'banned_members') is distinct from (old.data->'banned_members') and not is_club_owner(old.id) then
      raise exception 'Only the President can ban members.'; end if;
  end if;
  return new;
end $$;

-- ===================== Reports =====================
alter table public.reports add column if not exists context text;   -- where it happened, e.g. "Biology Club chat"
create or replace function public.trg_reports_guard() returns trigger language plpgsql set search_path = public as $$
declare mid text := my_member_id();
begin
  if not is_end_user() or is_admin() then return new; end if;
  new.reporter_id := coalesce(mid, new.reporter_id);
  new.reporter_email := lower(coalesce(auth.email(), new.reporter_email));
  new.reporter_name := coalesce((select name from profiles where member_id = mid limit 1), new.reporter_name);
  new.status := 'open';
  new.context := left(nullif(trim(coalesce(new.context, '')), ''), 120);
  return new;
end $$;
drop trigger if exists reports_guard on public.reports;
create trigger reports_guard before insert on public.reports for each row execute function public.trg_reports_guard();

-- Admin view: adds the reported listing's ID, the owner's / accused's email, and the reporter's email.
create or replace function public.admin_reports(p_all boolean default false)
returns table (id uuid, status text, created_at timestamptz, reason text, details text, context text,
  target_type text, target_id text, target_name text, target_public_id text, target_email text, target_owner_name text, target_owner_id text,
  reporter_name text, reporter_id text, reporter_email text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not is_admin() then raise exception 'Admins only.'; end if;
  return query
  select r.id, r.status, r.created_at, r.reason, r.details, r.context, r.target_type, r.target_id, r.target_name,
    case r.target_type when 'business' then b.public_id when 'club' then c.data->>'clubId' else tp.member_id end,
    case r.target_type when 'business' then b.owner_email when 'club' then cp.email else tp.email end,
    case r.target_type when 'club' then cp.name when 'user' then tp.name else null end,
    case r.target_type when 'club' then c.data->>'verifiedOwner' when 'user' then tp.member_id else null end,
    r.reporter_name, r.reporter_id, coalesce(rp.email, r.reporter_email)
  from reports r
  left join businesses b on r.target_type = 'business' and b.id::text = r.target_id
  left join clubs c on r.target_type = 'club' and c.id = r.target_id
  left join profiles cp on cp.member_id = c.data->>'verifiedOwner'
  left join profiles tp on r.target_type = 'user' and (tp.member_id = r.target_id or tp.member_id = '#' || r.target_id)
  left join profiles rp on rp.member_id = r.reporter_id
  where p_all or r.status = 'open'
  order by r.created_at desc;
end $$;
revoke execute on function public.admin_reports(boolean) from public, anon;
grant execute on function public.admin_reports(boolean) to authenticated;

-- ===================== Live admin badge =====================
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'reports') then
    alter publication supabase_realtime add table public.reports; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'contact_messages') then
    alter publication supabase_realtime add table public.contact_messages; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'verification_requests') then
    alter publication supabase_realtime add table public.verification_requests; end if;
end $$;
