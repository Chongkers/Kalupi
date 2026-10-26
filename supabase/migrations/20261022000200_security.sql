-- Kalupi security: row level security policies, triggers and functions.
--
-- Guardrails
--   Account owner only: profiles, accounts, categories, budgets, budget_items,
--                       presets, transactions
--   Tracker members:    trackers, tracker_members, tracker_invites
--
-- Members never read each other's transactions or profiles. Shared tracker
-- progress and member names come from public.tracker_progress(), which returns
-- totals only.
--
-- Nothing is hard-deleted through the API (there are no delete policies);
-- the app soft-deletes by setting deleted_at, which offline sync relies on.

-- ---------------------------------------------------------------------------
-- 0. Access baseline
-- ---------------------------------------------------------------------------

-- Logged-out visitors get nothing
revoke all on all tables in schema public from anon;

-- Helpers live in a schema the Data API doesn't expose
create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- 1. Helper functions used by policies
-- ---------------------------------------------------------------------------

-- security definer: runs with the owner's rights so it can read tracker_members
-- without triggering tracker_members' own policies (which would loop).
create function private.is_tracker_member(p_tracker_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tracker_members
    where tracker_id = p_tracker_id
      and user_id = (select auth.uid())
      and deleted_at is null
  );
$$;

create function private.is_tracker_owner(p_tracker_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tracker_members
    where tracker_id = p_tracker_id
      and user_id = (select auth.uid())
      and role = 'owner'
      and deleted_at is null
  );
$$;

revoke execute on function private.is_tracker_member(uuid), private.is_tracker_owner(uuid) from public, anon;
grant execute on function private.is_tracker_member(uuid), private.is_tracker_owner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Triggers
-- ---------------------------------------------------------------------------

-- 2a. updated_at is always set by the server (it's the sync cursor)
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.accounts
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.categories
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.trackers
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.budgets
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.budget_items
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.tracker_members
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.transactions
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.presets
  for each row execute function private.set_updated_at();

-- 2b. New sign-up: create the profile and starter categories
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');

  insert into public.categories (user_id, name, kind)
  values
    (new.id, 'Opening balance', 'income'),
    (new.id, 'Salary',          'income'),
    (new.id, 'Freelance',       'income'),
    (new.id, 'Other',           'income'),
    (new.id, 'Food & Dining',   'expense'),
    (new.id, 'Transportation',  'expense'),
    (new.id, 'Utilities',       'expense'),
    (new.id, 'Housing',         'expense'),
    (new.id, 'Healthcare',      'expense'),
    (new.id, 'Shopping',        'expense'),
    (new.id, 'Entertainment',   'expense'),
    (new.id, 'Other',           'expense');

  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- 2c. New tracker: its creator becomes the owner member
create function private.handle_new_tracker()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.tracker_members (tracker_id, user_id, role)
    values (new.id, new.created_by, 'owner');
  end if;
  return new;
end;
$$;

create trigger on_tracker_created after insert on public.trackers
  for each row execute function private.handle_new_tracker();

-- 2d. Column-level rules that policies can't express.
-- They only apply to app users (role "authenticated"); the dashboard and the
-- security definer functions below run as the owner and skip them.

create function private.guard_tracker_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if new.created_by is distinct from old.created_by then
      raise exception 'created_by cannot be changed';
    end if;
    if (new.archived_at is distinct from old.archived_at
        or new.deleted_at is distinct from old.deleted_at)
       and not private.is_tracker_owner(old.id) then
      raise exception 'Only the tracker owner can archive or delete it';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_tracker_update before update on public.trackers
  for each row execute function private.guard_tracker_update();

create function private.guard_member_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if new.tracker_id <> old.tracker_id or new.user_id <> old.user_id
       or new.role <> old.role or new.joined_at <> old.joined_at then
      raise exception 'Only leaving or removing a member is allowed';
    end if;
    if old.deleted_at is not null and new.deleted_at is null then
      raise exception 'Rejoining requires a new invite';
    end if;
    if old.role = 'owner' and new.deleted_at is not null then
      raise exception 'The owner cannot leave; archive or delete the tracker instead';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_member_update before update on public.tracker_members
  for each row execute function private.guard_member_update();

create function private.guard_invite_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if old.revoked_at is not null or new.revoked_at is null
       or (to_jsonb(new) - 'revoked_at') <> (to_jsonb(old) - 'revoked_at') then
      raise exception 'Invites can only be revoked';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_invite_update before update on public.tracker_invites
  for each row execute function private.guard_invite_update();

revoke execute on function
  private.set_updated_at(), private.handle_new_user(), private.handle_new_tracker(),
  private.guard_tracker_update(), private.guard_member_update(), private.guard_invite_update()
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Account owner tables
-- ---------------------------------------------------------------------------

-- profiles (created by the sign-up trigger, so no insert policy)
create policy "Own profile: read" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "Own profile: update" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- accounts
create policy "Own accounts: read" on public.accounts
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Own accounts: add" on public.accounts
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Own accounts: update" on public.accounts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- categories
create policy "Own categories: read" on public.categories
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Own categories: add" on public.categories
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Own categories: update" on public.categories
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- budgets
create policy "Own budgets: read" on public.budgets
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Own budgets: add" on public.budgets
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Own budgets: update" on public.budgets
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- budget_items: owned through the parent budget, and only with own categories
create policy "Own budget items: read" on public.budget_items
  for select to authenticated
  using (exists (
    select 1 from public.budgets b
    where b.id = budget_id and b.user_id = (select auth.uid())
  ));

create policy "Own budget items: add" on public.budget_items
  for insert to authenticated
  with check (
    exists (select 1 from public.budgets b
            where b.id = budget_id and b.user_id = (select auth.uid()))
    and exists (select 1 from public.categories c
                where c.id = category_id and c.user_id = (select auth.uid()))
  );

create policy "Own budget items: update" on public.budget_items
  for update to authenticated
  using (exists (
    select 1 from public.budgets b
    where b.id = budget_id and b.user_id = (select auth.uid())
  ))
  with check (
    exists (select 1 from public.budgets b
            where b.id = budget_id and b.user_id = (select auth.uid()))
    and exists (select 1 from public.categories c
                where c.id = category_id and c.user_id = (select auth.uid()))
  );

-- presets: anything they point to must be the user's own (or a tracker they're in)
create policy "Own presets: read" on public.presets
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Own presets: add" on public.presets
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (account_id is null or exists (select 1 from public.accounts a
         where a.id = account_id and a.user_id = (select auth.uid())))
    and (category_id is null or exists (select 1 from public.categories c
         where c.id = category_id and c.user_id = (select auth.uid())))
    and (tracker_id is null or private.is_tracker_member(tracker_id))
  );

create policy "Own presets: update" on public.presets
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (account_id is null or exists (select 1 from public.accounts a
         where a.id = account_id and a.user_id = (select auth.uid())))
    and (category_id is null or exists (select 1 from public.categories c
         where c.id = category_id and c.user_id = (select auth.uid())))
    and (tracker_id is null or private.is_tracker_member(tracker_id))
  );

-- transactions: same idea; contributing to a tracker requires membership
create policy "Own transactions: read" on public.transactions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Own transactions: add" on public.transactions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.accounts a
                where a.id = account_id and a.user_id = (select auth.uid()))
    and (to_account_id is null or exists (select 1 from public.accounts a
         where a.id = to_account_id and a.user_id = (select auth.uid())))
    and (category_id is null or exists (select 1 from public.categories c
         where c.id = category_id and c.user_id = (select auth.uid())))
    and (tracker_id is null or private.is_tracker_member(tracker_id))
  );

create policy "Own transactions: update" on public.transactions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.accounts a
                where a.id = account_id and a.user_id = (select auth.uid()))
    and (to_account_id is null or exists (select 1 from public.accounts a
         where a.id = to_account_id and a.user_id = (select auth.uid())))
    and (category_id is null or exists (select 1 from public.categories c
         where c.id = category_id and c.user_id = (select auth.uid())))
    and (tracker_id is null or private.is_tracker_member(tracker_id))
  );

-- ---------------------------------------------------------------------------
-- 4. Tracker member tables
-- ---------------------------------------------------------------------------

-- trackers. The created_by check lets the creator read the row back right after
-- inserting it, before the owner membership (added by trigger) is visible.
-- The owner can't leave, so this never outlives their membership.
create policy "Trackers: members read" on public.trackers
  for select to authenticated
  using (private.is_tracker_member(id) or created_by = (select auth.uid()));

create policy "Trackers: anyone creates their own" on public.trackers
  for insert to authenticated
  with check (created_by = (select auth.uid()));

-- archive/delete is owner-only, enforced by guard_tracker_update
create policy "Trackers: members update" on public.trackers
  for update to authenticated
  using (private.is_tracker_member(id))
  with check (private.is_tracker_member(id));

-- tracker_members. Rows are added only by triggers and accept_invite().
-- Your own row stays readable after leaving so other devices sync the change.
create policy "Members: read co-members" on public.tracker_members
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_tracker_member(tracker_id));

-- leave (own row) or remove someone (owner); guard_member_update limits the change
create policy "Members: leave or remove" on public.tracker_members
  for update to authenticated
  using (user_id = (select auth.uid()) or private.is_tracker_owner(tracker_id))
  with check (user_id = (select auth.uid()) or private.is_tracker_owner(tracker_id));

-- tracker_invites
create policy "Invites: members read" on public.tracker_invites
  for select to authenticated
  using (private.is_tracker_member(tracker_id));

create policy "Invites: members create" on public.tracker_invites
  for insert to authenticated
  with check (
    invited_by = (select auth.uid())
    and private.is_tracker_member(tracker_id)
    and accepted_by is null and accepted_at is null and revoked_at is null
  );

-- revoke: whoever sent it, or the owner; guard_invite_update limits the change
create policy "Invites: sender or owner revokes" on public.tracker_invites
  for update to authenticated
  using (invited_by = (select auth.uid()) or private.is_tracker_owner(tracker_id))
  with check (invited_by = (select auth.uid()) or private.is_tracker_owner(tracker_id));

-- ---------------------------------------------------------------------------
-- 5. Functions the app calls (supabase.rpc(...))
-- ---------------------------------------------------------------------------

-- Join a tracker from an invite link. Returns the tracker id.
create function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_invite public.tracker_invites;
begin
  if v_user is null then
    raise exception 'Not logged in';
  end if;

  select * into v_invite
  from public.tracker_invites
  where token = p_token
  for update;

  if not found or v_invite.revoked_at is not null then
    raise exception 'This invite link is not valid';
  end if;

  -- Already a member: nothing to do, and the invite stays usable for someone else
  if exists (select 1 from public.tracker_members
             where tracker_id = v_invite.tracker_id and user_id = v_user
               and deleted_at is null) then
    return v_invite.tracker_id;
  end if;

  if v_invite.accepted_at is not null then
    raise exception 'This invite link has already been used';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'This invite link has expired';
  end if;

  -- Rejoining after leaving reuses the old membership row
  insert into public.tracker_members (tracker_id, user_id, role)
  values (v_invite.tracker_id, v_user, 'editor')
  on conflict (tracker_id, user_id)
  do update set deleted_at = null, role = 'editor', joined_at = now();

  update public.tracker_invites
  set accepted_by = v_user, accepted_at = now()
  where id = v_invite.id;

  return v_invite.tracker_id;
end;
$$;

-- Progress of every tracker the user belongs to, one row per person who is a
-- member or has contributed. Totals only; no transaction details are exposed.
create function public.tracker_progress()
returns table (
  tracker_id    uuid,
  user_id       uuid,
  display_name  text,
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
         m.role,
         coalesce(t.net_amount, 0)
  from members m
  full join totals t on t.tracker_id = m.tracker_id and t.user_id = m.user_id
  left join public.profiles p on p.id = coalesce(m.user_id, t.user_id);
$$;

revoke execute on function public.accept_invite(text), public.tracker_progress() from public, anon;
grant execute on function public.accept_invite(text), public.tracker_progress() to authenticated;
