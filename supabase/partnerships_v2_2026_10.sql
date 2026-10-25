-- ============================================================
-- Partnerships v2 + business promotions + club records without emails
-- (applied to project xadmwmwagxeiidmeqspa on 2026-10-25 as migrations
--  partnerships_v2_and_promotions, club_blob_no_emails,
--  partnerships_v2_hardening, partnerships_v2_hardening_2).
-- This file shows the FINAL state; it is safe to re-run.
-- ============================================================

-- ===================== Partnerships v2 =====================
-- ptype     = partnership type (shown as its own chip; the deal text is stored alone)
-- awaiting  = whose turn it is while pending ('a' = sender, 'b' = recipient)
-- history   = every version of the terms: [{by, at, ptype, deal, start, end}, ...]
-- a/b_timer = each side's countdown-timer switch; decided_at = when it was approved/declined/withdrawn/ended
alter table public.partner_agreements add column if not exists ptype text;
alter table public.partner_agreements add column if not exists awaiting text not null default 'b';
alter table public.partner_agreements add column if not exists history jsonb not null default '[]'::jsonb;
alter table public.partner_agreements add column if not exists a_timer boolean not null default false;
alter table public.partner_agreements add column if not exists b_timer boolean not null default false;
alter table public.partner_agreements add column if not exists decided_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'partner_agreements_awaiting_chk') then
    alter table public.partner_agreements add constraint partner_agreements_awaiting_chk check (awaiting in ('a', 'b'));
  end if;
end $$;
-- old rows stored "Type: description" in one field: split it
update public.partner_agreements
   set ptype = split_part(a_deal, ': ', 1),
       a_deal = substr(a_deal, length(split_part(a_deal, ': ', 1)) + 3),
       b_deal = case when b_deal like split_part(a_deal, ': ', 1) || ': %' then substr(b_deal, length(split_part(a_deal, ': ', 1)) + 3) else b_deal end
 where ptype is null and split_part(a_deal, ': ', 1) in ('Discount for members', 'Sponsorship / funding', 'Event collaboration', 'Other');

-- Only the two sides can see a request or a past partnership; everyone sees live ones.
drop policy if exists "pa read" on public.partner_agreements;
create policy "pa read" on public.partner_agreements for select
  using (status = 'launched' or owns_entity(a_type, a_id) or owns_entity(b_type, b_id) or is_admin());

-- The real name of a club/business, and whether it is open to partnerships.
create or replace function public._entity_name(t text, eid text) returns text language sql stable security definer set search_path to 'public' as $$
  select case when t = 'club' then (select data->>'name' from clubs where id = eid)
              when t = 'business' then (select name from businesses where id::text = eid) end $$;
create or replace function public._entity_open(t text, eid text) returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(case when t = 'club' then (select data->>'partnershipOpen' = 'true' from clubs where id = eid)
                       when t = 'business' then (select partnership_open from businesses where id::text = eid) end, false) $$;
revoke execute on function public._entity_name(text, text) from public, anon;
revoke execute on function public._entity_open(text, text) from public, anon;
grant execute on function public._entity_name(text, text) to authenticated;
grant execute on function public._entity_open(text, text) to authenticated;

-- Turns, counter-offers, the 3-active limit, and "each side controls only its own switches".
create or replace function public.trg_partner_guard() returns trigger language plpgsql as $$
declare mine_a boolean; mine_b boolean; terms_changed boolean; my_turn boolean; n int;
begin
  if not is_end_user() or is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    if not owns_entity(new.a_type, new.a_id) then raise exception 'You can only send a request from a club or business you run.'; end if;
    if new.a_type = new.b_type and new.a_id = new.b_id then raise exception 'You can’t partner with yourself.'; end if;
    if _entity_name(new.b_type, new.b_id) is null then raise exception 'That club or business doesn’t exist.'; end if;
    if not _entity_open(new.b_type, new.b_id) then raise exception 'They aren’t open to partnerships right now.'; end if;
    -- names come from the real listings; both sides always share one set of terms
    new.a_name := _entity_name(new.a_type, new.a_id); new.b_name := _entity_name(new.b_type, new.b_id);
    new.b_deal := new.a_deal; new.b_start := new.a_start; new.b_end := new.a_end;
    new.status := 'pending'; new.awaiting := 'b'; new.a_hidden := false; new.b_hidden := false; new.a_timer := false; new.b_timer := false;
    new.launched_at := null; new.decided_at := null;
    new.history := jsonb_build_array(jsonb_build_object('by', 'a', 'at', now(), 'ptype', new.ptype, 'deal', new.a_deal, 'start', new.a_start, 'end', new.a_end));
    return new;
  end if;
  mine_a := owns_entity(old.a_type, old.a_id); mine_b := owns_entity(old.b_type, old.b_id);
  -- the two parties never change
  new.a_type := old.a_type; new.a_id := old.a_id; new.b_type := old.b_type; new.b_id := old.b_id;
  new.a_name := old.a_name; new.b_name := old.b_name;
  new.launched_at := old.launched_at; new.decided_at := old.decided_at;
  new.b_deal := new.a_deal; new.b_start := new.a_start; new.b_end := new.a_end;
  -- each side controls only its own visibility and countdown timer
  if not mine_a then new.a_hidden := old.a_hidden; new.a_timer := old.a_timer; end if;
  if not mine_b then new.b_hidden := old.b_hidden; new.b_timer := old.b_timer; end if;
  my_turn := (old.awaiting = 'a' and mine_a) or (old.awaiting = 'b' and mine_b);
  terms_changed := (new.ptype, new.a_deal, new.a_start, new.a_end) is distinct from (old.ptype, old.a_deal, old.a_start, old.a_end);
  new.history := old.history;
  if terms_changed then
    if old.status <> 'pending' then raise exception 'An active partnership can’t be edited. End it and send a new request.'; end if;
    if not my_turn then raise exception 'It’s the other side’s turn to respond.'; end if;
    if new.status is distinct from old.status then raise exception 'Send your changes first; the other side approves them.'; end if;
    -- a counter-proposal: record it and hand the turn to the other side
    new.history := old.history || jsonb_build_array(jsonb_build_object('by', old.awaiting, 'at', now(), 'ptype', new.ptype, 'deal', new.a_deal, 'start', new.a_start, 'end', new.a_end));
    new.awaiting := case when old.awaiting = 'a' then 'b' else 'a' end;
    return new;
  end if;
  new.awaiting := old.awaiting;
  if new.status is distinct from old.status then
    if old.status = 'pending' and new.status = 'launched' then
      if not my_turn then raise exception 'Only the side that was asked can approve this.'; end if;
      select count(*) into n from partner_agreements p where p.status = 'launched' and coalesce(p.a_end, p.b_end) >= current_date
        and ((p.a_type = old.a_type and p.a_id = old.a_id) or (p.b_type = old.a_type and p.b_id = old.a_id));
      if n >= 3 then raise exception '% already has 3 active partnerships, the limit. One has to end first.', old.a_name; end if;
      select count(*) into n from partner_agreements p where p.status = 'launched' and coalesce(p.a_end, p.b_end) >= current_date
        and ((p.a_type = old.b_type and p.a_id = old.b_id) or (p.b_type = old.b_type and p.b_id = old.b_id));
      if n >= 3 then raise exception '% already has 3 active partnerships, the limit. One has to end first.', old.b_name; end if;
      new.launched_at := now();
    elsif old.status = 'pending' and new.status in ('declined', 'deleted') then null;
    elsif old.status = 'launched' and new.status = 'ended' then null;
    else raise exception 'That change isn’t allowed.'; end if;
    new.decided_at := now();
  end if;
  return new;
end $$;
drop trigger if exists partner_guard on public.partner_agreements;
create trigger partner_guard before insert or update on public.partner_agreements for each row execute function public.trg_partner_guard();

-- ===================== Business promotions (the business's own deals, up to 3 at once) =====================
create table if not exists public.business_promotions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('discount', 'bogo', 'coupon', 'freebie', 'bundle', 'other')),
  kind_other text,
  description text not null check (char_length(description) between 1 and 400),
  redemption text,
  audience text not null default 'student' check (audience in ('student', 'everyone')),
  starts date not null,
  ends date not null,
  hidden boolean not null default false,
  timer boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends >= starts),
  check (kind <> 'other' or char_length(coalesce(kind_other, '')) between 1 and 40)
);
alter table public.business_promotions enable row level security;
drop policy if exists "promo read" on public.business_promotions;
drop policy if exists "promo write" on public.business_promotions;
create policy "promo read" on public.business_promotions for select using (not hidden or owns_business(business_id::text) or is_admin());
create policy "promo write" on public.business_promotions for all using (owns_business(business_id::text)) with check (owns_business(business_id::text));
create or replace function public.trg_promo_limit() returns trigger language plpgsql as $$
declare n int;
begin
  if new.ends < current_date then return new; end if;   -- an ended promotion doesn't count
  select count(*) into n from business_promotions where business_id = new.business_id and ends >= current_date and id <> new.id;
  if n >= 3 then raise exception 'You can run up to 3 promotions at once. Delete or wait for one to end first.'; end if;
  return new;
end $$;
drop trigger if exists promo_limit on public.business_promotions;
create trigger promo_limit before insert or update of ends on public.business_promotions for each row execute function public.trg_promo_limit();

-- carry over each business's single old deal (businesses.perk_*) as its first promotion
insert into public.business_promotions (business_id, kind, kind_other, description, redemption, audience, starts, ends, hidden)
select b.id,
       case b.perk_type when 'addon' then 'freebie' when 'sponsorship' then 'other' else 'discount' end,
       case b.perk_type when 'sponsorship' then 'Club sponsorship' else null end,
       left(b.perk_description, 400), nullif(b.redemption_instructions, ''), coalesce(nullif(b.perk_audience, ''), 'student'),
       coalesce(b.perk_start, b.created_at::date, current_date),
       greatest(coalesce(b.perk_end, current_date + 90), coalesce(b.perk_start, b.created_at::date, current_date)),
       coalesce(b.deal_hidden, false)
  from public.businesses b
 where coalesce(trim(b.perk_description), '') <> ''
   and not exists (select 1 from public.business_promotions p where p.business_id = b.id);
-- (businesses.perk_* / deal_hidden are no longer used by the site.)

-- ===================== Club records never carry emails =====================
-- The public clubs.data blob used to keep leaders[].email / roster[].email. Strip them on every write.
create or replace function public.trg_club_strip_emails() returns trigger language plpgsql as $$
begin
  if jsonb_typeof(new.data->'leaders') = 'array' then
    new.data := jsonb_set(new.data, '{leaders}', coalesce((select jsonb_agg(l - 'email') from jsonb_array_elements(new.data->'leaders') l), '[]'::jsonb));
  end if;
  if jsonb_typeof(new.data->'roster') = 'array' then
    new.data := jsonb_set(new.data, '{roster}', coalesce((select jsonb_agg(l - 'email') from jsonb_array_elements(new.data->'roster') l), '[]'::jsonb));
  end if;
  return new;
end $$;
drop trigger if exists club_strip_emails on public.clubs;
create trigger club_strip_emails before insert or update on public.clubs for each row execute function public.trg_club_strip_emails();
-- one-time cleanup of existing rows (fires the trigger above)
update public.clubs set data = data where jsonb_typeof(data->'leaders') = 'array' or jsonb_typeof(data->'roster') = 'array';

-- pin the search path of the new trigger functions (Supabase security advisor)
alter function public.trg_partner_guard() set search_path = public;
alter function public.trg_promo_limit() set search_path = public;
alter function public.trg_club_strip_emails() set search_path = public;
