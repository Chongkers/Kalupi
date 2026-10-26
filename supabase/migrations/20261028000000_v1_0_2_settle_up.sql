-- Version 1.0.2: settle-up trackers (who owes what after an event).
-- Run after 20261027000000_avatar_url_check.sql.
--
-- A tracker is now either a saving goal (as before) or a settle-up list. Settle-up trackers are
-- personal for now: the people on them are names the user types in, not Kalupi accounts.

-- ---------------------------------------------------------------------------
-- 1. Trackers: a kind. Settle-up trackers have no target.
-- ---------------------------------------------------------------------------
alter table public.trackers
  add column kind text not null default 'goal' check (kind in ('goal', 'split'));

alter table public.trackers
  alter column target_amount drop not null,
  add constraint trackers_goal_target_check check (kind = 'split' or target_amount is not null);

-- Settle-up trackers can't be shared yet, so no invites for them
drop policy "Invites: members create" on public.tracker_invites;

create policy "Invites: members create" on public.tracker_invites
  for insert to authenticated
  with check (
    invited_by = (select auth.uid())
    and private.is_tracker_member(tracker_id)
    and exists (select 1 from public.trackers t where t.id = tracker_id and t.kind = 'goal')
    and accepted_by is null and accepted_at is null and revoked_at is null
  );

-- ---------------------------------------------------------------------------
-- 2. People on a settle-up tracker (names only)
-- ---------------------------------------------------------------------------
create table public.split_people (
  id           uuid primary key default gen_random_uuid(),
  tracker_id   uuid not null references public.trackers (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 40),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index split_people_tracker_id_idx on public.split_people (tracker_id);
create index split_people_user_updated_at_idx on public.split_people (user_id, updated_at);

alter table public.split_people enable row level security;

create trigger set_updated_at before update on public.split_people
  for each row execute function private.set_updated_at();

create policy "Own split people: read" on public.split_people
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Own split people: add" on public.split_people
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_tracker_member(tracker_id));

create policy "Own split people: update" on public.split_people
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.is_tracker_member(tracker_id));

-- ---------------------------------------------------------------------------
-- 3. Shares: what one person owes you (positive) or you owe them (negative).
--    - You paid a bill: one row per friend, linked to your expense transaction.
--    - A friend paid: one row for your share (negative), with the category it counts
--      toward in your budget, and no transaction (no money moved yet).
--    - A payback: one row linked to the settle_in / settle_out transaction.
-- ---------------------------------------------------------------------------
create table public.split_shares (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  tracker_id      uuid not null references public.trackers (id) on delete cascade,
  person_id       uuid not null references public.split_people (id) on delete cascade,
  transaction_id  uuid references public.transactions (id) on delete cascade,
  category_id     uuid references public.categories (id),
  amount          bigint not null check (amount <> 0),  -- centavos; + they owe you, − you owe them
  occurred_on     date not null,
  note            text check (note is null or char_length(note) <= 200),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  check (
    (transaction_id is not null and category_id is null)
    or
    (transaction_id is null and category_id is not null and amount < 0)
  )
);

create index split_shares_tracker_id_idx on public.split_shares (tracker_id);
create index split_shares_person_id_idx on public.split_shares (person_id);
create index split_shares_transaction_id_idx on public.split_shares (transaction_id);
create index split_shares_category_id_idx on public.split_shares (category_id);
create index split_shares_user_updated_at_idx on public.split_shares (user_id, updated_at);

alter table public.split_shares enable row level security;

create trigger set_updated_at before update on public.split_shares
  for each row execute function private.set_updated_at();

create policy "Own split shares: read" on public.split_shares
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Own split shares: add" on public.split_shares
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and private.is_tracker_member(tracker_id)
    and exists (select 1 from public.split_people p
                where p.id = person_id and p.user_id = (select auth.uid()) and p.tracker_id = split_shares.tracker_id)
    and (transaction_id is null or exists (select 1 from public.transactions t
         where t.id = transaction_id and t.user_id = (select auth.uid())))
    and (category_id is null or exists (select 1 from public.categories c
         where c.id = category_id and c.user_id = (select auth.uid())))
  );

create policy "Own split shares: update" on public.split_shares
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and private.is_tracker_member(tracker_id)
    and exists (select 1 from public.split_people p
                where p.id = person_id and p.user_id = (select auth.uid()) and p.tracker_id = split_shares.tracker_id)
    and (transaction_id is null or exists (select 1 from public.transactions t
         where t.id = transaction_id and t.user_id = (select auth.uid())))
    and (category_id is null or exists (select 1 from public.categories c
         where c.id = category_id and c.user_id = (select auth.uid())))
  );

-- ---------------------------------------------------------------------------
-- 4. Transactions: paybacks, and expenses that belong to a settle-up tracker.
--    settle_in  = a friend paid you back (money into an account, not income)
--    settle_out = you paid a friend back (money out of an account, not spending)
-- ---------------------------------------------------------------------------
alter table public.transactions drop constraint transactions_type_check;
alter table public.transactions drop constraint transactions_links_check;

alter table public.transactions
  add constraint transactions_type_check
    check (type in ('income', 'expense', 'contribution', 'withdrawal', 'transfer', 'settle_in', 'settle_out')),
  add constraint transactions_links_check check (
    (type = 'income'
      and category_id is not null and tracker_id is null and to_account_id is null)
    or
    -- tracker_id set = a bill on a settle-up tracker
    (type = 'expense'
      and category_id is not null and to_account_id is null)
    or
    (type in ('contribution', 'withdrawal', 'settle_in', 'settle_out')
      and tracker_id is not null and category_id is null and to_account_id is null)
    or
    (type = 'transfer'
      and to_account_id is not null and to_account_id <> account_id
      and category_id is null and tracker_id is null)
  );
