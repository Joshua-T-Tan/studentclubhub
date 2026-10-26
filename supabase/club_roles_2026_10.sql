-- ============================================================
-- Club roles hardening (applied 2026-10-26 as migration club_roles_hardening)
--   * exactly one President per club (unique index) + transfer_presidency() does the
--     whole hand-off in one transaction (roles, owner, leaders, chat notice)
--   * chat: officers-only chat / announcements / system notices are enforced here,
--     and the sender's name always comes from their account
--   * names on rosters and reviews come from the account (no posting as someone else)
--   * cleanup: roster rows of deleted accounts; duplicate Presidents
-- Final state; safe to re-run.
-- ============================================================

-- ---------- cleanup before the unique index ----------
-- rows left behind by accounts that no longer exist (e.g. a merged duplicate account)
delete from public.club_members m
 where m.member_id like '#%' and not exists (select 1 from public.profiles p where p.member_id = m.member_id);
-- more than one President: keep the club's owner (or the earliest), the rest become Members
update public.club_members m set role = 'Member'
 where m.role = 'President'
   and exists (select 1 from public.club_members o where o.club_id = m.club_id and o.role = 'President' and o.id <> m.id)
   and m.member_id is distinct from (select c.data->>'verifiedOwner' from public.clubs c where c.id = m.club_id)
   and (exists (select 1 from public.club_members o join public.clubs c on c.id = o.club_id
                 where o.club_id = m.club_id and o.role = 'President' and o.member_id = c.data->>'verifiedOwner')
        or m.joined_at > (select min(o.joined_at) from public.club_members o where o.club_id = m.club_id and o.role = 'President'));
create unique index if not exists club_members_one_president on public.club_members (club_id) where role = 'President';

-- ---------- presidency hand-off, atomically ----------
create or replace function public.transfer_presidency(p_club text, p_member text, p_leave boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare me text := my_member_id(); their_role text; their_name text; my_name text;
begin
  if me is null or not is_club_owner(p_club) then raise exception 'Only the President can hand off the club.'; end if;
  if p_member is null or p_member = me then raise exception 'Pick another member to be President.'; end if;
  select role, name into their_role, their_name from club_members where club_id = p_club and member_id = p_member;
  if not found then raise exception 'That person isn’t a member of this club anymore.'; end if;
  select name into my_name from club_members where club_id = p_club and member_id = me;
  my_name := coalesce(my_name, (select name from profiles where member_id = me), 'The former President');
  their_role := coalesce(nullif(their_role, 'President'), 'Member');
  -- free the President slot first (one President per club), then fill it
  if p_leave then delete from club_members where club_id = p_club and member_id = me;
  else update club_members set role = their_role where club_id = p_club and member_id = me; end if;
  update club_members set role = 'President' where club_id = p_club and member_id = p_member;
  update clubs set updated_at = now(),
    data = jsonb_set(data, '{verifiedOwner}', to_jsonb(p_member)) || jsonb_build_object('leaders',
      (select coalesce(jsonb_agg(case when l->>'role' = 'President' then jsonb_set(l, '{name}', to_jsonb(their_name)) else l end), '[]'::jsonb)
         from jsonb_array_elements(case when jsonb_typeof(data->'leaders') = 'array' then data->'leaders' else '[]'::jsonb end) l))
   where id = p_club;
  insert into club_chat (club_id, sender_id, sender_name, system, text) values (p_club, me, 'System', true,
    case when p_leave then their_name || ' is now President; ' || my_name || ' left the club.'
         else their_name || ' is now President; ' || my_name || ' is now ' || their_role || '.' end);
end $$;
revoke execute on function public.transfer_presidency(text, text, boolean) from public, anon;
grant execute on function public.transfer_presidency(text, text, boolean) to authenticated;

-- ---------- roster rows: banned check, roles, real names ----------
create or replace function public.trg_club_members_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if not is_end_user() or is_admin() or legacy_writes_on() then return new; end if;
  if tg_op = 'INSERT' then
    if new.member_id = my_member_id() then
      if exists (select 1 from clubs where id = new.club_id and coalesce(data->'banned_members', '[]'::jsonb) ? new.member_id) then
        raise exception 'You''ve been banned from this club.'; end if;
      if coalesce(new.role, 'Member') <> 'Member' and not is_club_owner(new.club_id) then new.role := 'Member'; end if;
      new.name := coalesce((select name from profiles where member_id = new.member_id limit 1), new.name);
    end if;
    return new;
  end if;
  if new.club_id is distinct from old.club_id or new.member_id is distinct from old.member_id then raise exception 'Not allowed.'; end if;
  if new.role is distinct from old.role and not is_club_owner(old.club_id) then raise exception 'Only the President can change roles.'; end if;
  if new.role = 'President' and old.role is distinct from 'President' then
    raise exception 'To make someone President, use “Make President” (it hands the club over).'; end if;
  return new;
end $$;

-- ---------- chat ----------
create or replace function public.trg_club_chat_guard() returns trigger language plpgsql set search_path = public as $$
declare officer boolean;
begin
  if not is_end_user() or is_admin() or legacy_writes_on() then return new; end if;
  if tg_op = 'INSERT' then
    officer := is_club_officer(new.club_id);
    new.sender_id := my_member_id();
    new.edited := false; new.deleted := false;
    if coalesce(new.system, false) then
      if not officer then raise exception 'Only club officers can post notices.'; end if;
      new.sender_name := 'System'; new.announce := false;
    else
      new.system := false;
      new.sender_name := coalesce((select name from profiles where member_id = new.sender_id limit 1), new.sender_name);
      if coalesce(new.announce, false) and not officer then new.announce := false; end if;
      if not officer and exists (select 1 from clubs where id = new.club_id and data->>'chatAccess' = 'officers') then
        raise exception 'Only officers can post in this club’s chat right now.'; end if;
    end if;
    return new;
  end if;
  -- UPDATE (author only, by policy): just the text, "edited" and "deleted"
  new.club_id := old.club_id; new.sender_id := old.sender_id; new.sender_name := old.sender_name;
  new.system := old.system; new.announce := old.announce; new.created_at := old.created_at;
  return new;
end $$;
drop trigger if exists club_chat_guard on public.club_chat;
create trigger club_chat_guard before insert or update on public.club_chat for each row execute function public.trg_club_chat_guard();

-- ---------- reviews: the author is whoever is signed in ----------
create or replace function public.trg_review_author() returns trigger language plpgsql set search_path = public as $$
declare mid text := my_member_id();
begin
  if not is_end_user() or is_admin() or legacy_writes_on() then return new; end if;
  new.author_id := mid;
  new.author := coalesce((select name from profiles where member_id = mid limit 1), new.author);
  return new;
end $$;
drop trigger if exists club_reviews_author on public.club_reviews;
create trigger club_reviews_author before insert on public.club_reviews for each row execute function public.trg_review_author();
drop trigger if exists biz_reviews_author on public.biz_reviews;
create trigger biz_reviews_author before insert on public.biz_reviews for each row execute function public.trg_review_author();
