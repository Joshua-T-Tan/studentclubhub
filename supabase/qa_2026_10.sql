-- QA pass (2026-10-24) — already applied to project xadmwmwagxeiidmeqspa as migration
-- "qa_profiles_private_ratings_site_reviews". Kept here so the schema is reproducible.

-- Profile privacy is read by other accounts (not just this browser).
alter table public.profiles add column if not exists private boolean default false;

-- Business reviews are tied to an account (one per member, editable/deletable by its author).
alter table public.biz_reviews add column if not exists author_id text;

-- businesses.rating / review_count are recomputed by the database on every review change.
create or replace function public.refresh_business_rating(bid uuid) returns void
language sql security definer set search_path to 'public' as $$
  update public.businesses b
     set rating = coalesce((select round(avg(r.rating)::numeric, 1) from public.biz_reviews r where r.business_id = bid), 0),
         review_count = (select count(*) from public.biz_reviews r where r.business_id = bid)
   where b.id = bid;
$$;
create or replace function public.trg_biz_reviews_rating() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op in ('INSERT','UPDATE') then perform public.refresh_business_rating(new.business_id); end if;
  if tg_op in ('UPDATE','DELETE') then perform public.refresh_business_rating(old.business_id); end if;
  return null;
end $$;
drop trigger if exists biz_reviews_rating on public.biz_reviews;
create trigger biz_reviews_rating after insert or update or delete on public.biz_reviews
  for each row execute function public.trg_biz_reviews_rating();
select public.refresh_business_rating(id) from public.businesses;   -- backfill

-- Homepage "website reviews" (seeds stay static in the JS).
create table if not exists public.site_reviews (
  id uuid primary key default gen_random_uuid(),
  author_id text, author text, role text,
  rating integer check (rating between 1 and 5),
  text text, created_at timestamptz default now()
);
alter table public.site_reviews enable row level security;
drop policy if exists site_reviews_read on public.site_reviews;
create policy site_reviews_read on public.site_reviews for select using (true);
drop policy if exists site_reviews_write on public.site_reviews;
create policy site_reviews_write on public.site_reviews for all using (true) with check (true);

-- Migration "qa_missing_delete_policies": deleting your own review, a club's chat, a profile
-- (account deletion) and a business listing silently did nothing without these.
create policy "br delete" on public.biz_reviews for delete using (true);
create policy "prof delete" on public.profiles for delete using (true);
create policy "cc delete" on public.club_chat for delete using (true);
create policy "biz delete (mvp)" on public.businesses for delete using (true);
