-- ============================================================
-- Student Club Hub — schema for the Oct 2026 feature batch.
-- Run this in the Supabase SQL editor. MVP-permissive RLS
-- (matches the rest of the app; see CLAUDE.md §6 security notes).
-- ============================================================

-- 1) Reports (club / business / user) — Roblox-style report form
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  reporter_email text,
  reporter_name  text,
  reporter_id    text,              -- member id of reporter
  target_type   text not null,      -- 'club' | 'business' | 'user'
  target_id     text not null,      -- club id / business id / member id
  target_name   text,
  reason        text not null,      -- dropdown value
  details       text,               -- free-text "what happened"
  status        text default 'open',-- open | reviewed | dismissed
  created_at    timestamptz default now()
);
alter table public.reports enable row level security;
drop policy if exists reports_all on public.reports;
create policy reports_all on public.reports for all using (true) with check (true);

-- 2) Contact-Us messages (logged-in users submit; you review in the dashboard)
create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  sender_email text,
  sender_name  text,
  member_id    text,
  message      text not null,
  source       text default 'contact_us',  -- contact_us | about_us
  handled      boolean default false,
  created_at   timestamptz default now()
);
alter table public.contact_messages enable row level security;
drop policy if exists contact_all on public.contact_messages;
create policy contact_all on public.contact_messages for all using (true) with check (true);

-- 3) Businesses: self-serve verification flag + review-section toggle
--    (clubs store these in their JSONB blob — no migration needed for clubs)
alter table public.businesses add column if not exists verified boolean default false;
alter table public.businesses add column if not exists reviews_enabled boolean default true;

-- 4) Partnership requests reuse the EXISTING partner_agreements table
--    (status 'pending' -> 'launched' on approve / 'declined' on reject /
--     'ended' on end). No migration needed; columns already exist.
