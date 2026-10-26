-- Version 1.0.1: category icons and colors, profile pictures.
-- Run after 20261024000000_trackers_presets_launch.sql.

-- ---------------------------------------------------------------------------
-- 1. Categories: an icon and a color, picked by the user.
--    null = the app picks one from the category's name.
-- ---------------------------------------------------------------------------
alter table public.categories
  add column icon text check (icon is null or icon ~ '^[a-z0-9-]{1,40}$'),
  add column color text check (color is null or color ~ '^[a-z]{1,20}$');

-- ---------------------------------------------------------------------------
-- 2. Profile pictures, stored in a public "avatars" bucket at <user id>/avatar.jpg.
--    Public read: the link is shown to tracker partners and cached for offline use.
--    Only the owner can add, replace or remove their own picture.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Avatars: owner uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Avatars: owner replaces" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Avatars: owner removes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Upserts read the existing object first, so the owner also needs to see their own files
create policy "Avatars: owner reads" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- 3. tracker_progress() also returns each member's picture.
--    The return type changes, so it has to be dropped and created again.
-- ---------------------------------------------------------------------------
drop function public.tracker_progress();

create function public.tracker_progress()
returns table (
  tracker_id    uuid,
  user_id       uuid,
  display_name  text,
  avatar_url    text,
  role          text,   -- null for a former member
  net_amount    bigint  -- contributions minus withdrawals, in centavos
)
language sql
stable
security definer
set search_path = ''
as $$
  with my_trackers as (
    select m.tracker_id
    from public.tracker_members m
    where m.user_id = (select auth.uid()) and m.deleted_at is null
  ),
  totals as (
    select t.tracker_id, t.user_id,
           sum(case when t.type = 'contribution' then t.amount else -t.amount end)::bigint as net_amount
    from public.transactions t
    join my_trackers mt on mt.tracker_id = t.tracker_id
    where t.type in ('contribution', 'withdrawal') and t.deleted_at is null
    group by t.tracker_id, t.user_id
  ),
  members as (
    select m.tracker_id, m.user_id, m.role
    from public.tracker_members m
    join my_trackers mt on mt.tracker_id = m.tracker_id
    where m.deleted_at is null
  )
  select coalesce(m.tracker_id, t.tracker_id),
         coalesce(m.user_id, t.user_id),
         p.display_name,
         p.avatar_url,
         m.role,
         coalesce(t.net_amount, 0)
  from members m
  full join totals t on t.tracker_id = m.tracker_id and t.user_id = m.user_id
  left join public.profiles p on p.id = coalesce(m.user_id, t.user_id);
$$;

revoke execute on function public.tracker_progress() from public, anon;
grant execute on function public.tracker_progress() to authenticated;
