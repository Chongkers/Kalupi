-- Phases 7–11: custom monthly limit, preset archiving, invite preview, keep-alive.
-- Run after 20261022000200_security.sql.

-- ---------------------------------------------------------------------------
-- 1. Budgets: an optional overall limit for the month.
--    null = the total is the sum of the category limits (as before).
-- ---------------------------------------------------------------------------
alter table public.budgets
  add column total_limit bigint check (total_limit is null or total_limit > 0);

-- ---------------------------------------------------------------------------
-- 2. Presets can be archived (hidden from quick add, kept for history)
-- ---------------------------------------------------------------------------
alter table public.presets
  add column archived_at timestamptz;

-- ---------------------------------------------------------------------------
-- 3. Invite preview: what someone sees on /invite/[token] before joining.
--    They aren't a member yet, so RLS hides the tracker; this returns only
--    the tracker name, who sent it, and whether the link still works.
-- ---------------------------------------------------------------------------
create function public.invite_details(p_token text)
returns table (
  tracker_id    uuid,
  tracker_name  text,
  invited_by    text,
  status        text,  -- 'valid' | 'member' | 'used' | 'expired' | 'revoked'
  expires_at    timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.tracker_id,
         t.name,
         p.display_name,
         case
           when exists (select 1 from public.tracker_members m
                        where m.tracker_id = i.tracker_id and m.user_id = (select auth.uid())
                          and m.deleted_at is null) then 'member'
           when i.revoked_at is not null or t.deleted_at is not null then 'revoked'
           when i.accepted_at is not null then 'used'
           when i.expires_at < now() then 'expired'
           else 'valid'
         end,
         i.expires_at
  from public.tracker_invites i
  join public.trackers t on t.id = i.tracker_id
  left join public.profiles p on p.id = i.invited_by
  where i.token = p_token;
$$;

revoke execute on function public.invite_details(text) from public, anon;
grant execute on function public.invite_details(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Keep-alive: a daily cron calls this so the free project never pauses.
--    Reads nothing; logged-out callers may run it.
-- ---------------------------------------------------------------------------
create function public.ping()
returns integer
language sql
stable
set search_path = ''
as $$
  select 1;
$$;

revoke execute on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
