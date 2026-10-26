-- Version 1.0.1 fix: profiles.avatar_url can only point to the user's own picture.
-- Run after 20261026000000_v1_0_1.sql.
--
-- Users can update their own profile row directly through the API, so without this anyone
-- could set avatar_url to an image on their own server. Tracker partners' devices would then
-- load it, leaking their IP address and when they opened the tracker.

-- Clear any link that isn't the user's own file in the avatars bucket (the app never sets one)
update public.profiles
set avatar_url = null
where avatar_url is not null
  and avatar_url !~ ('^https://[a-z0-9.-]+/storage/v1/object/public/avatars/' || id::text || '/avatar\.jpg(\?v=[0-9]+)?$');

alter table public.profiles
  add constraint profiles_avatar_url_own_file check (
    avatar_url is null
    or avatar_url ~ ('^https://[a-z0-9.-]+/storage/v1/object/public/avatars/' || id::text || '/avatar\.jpg(\?v=[0-9]+)?$')
  );
