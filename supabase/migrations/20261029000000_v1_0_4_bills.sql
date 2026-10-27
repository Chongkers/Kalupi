-- Version 1.0.4: monthly bills and bill reminders.
-- Run after 20261028000000_v1_0_3_settle_up.sql.
--
-- A bill is a reminder, not money: nothing moves until the user confirms it on (or after) its due
-- date. Confirming logs a normal expense and records a bill_payment for that month; skipping records
-- a bill_payment with no transaction. Bills are private (owner only).

-- ---------------------------------------------------------------------------
-- 1. bills
-- ---------------------------------------------------------------------------
create table public.bills (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 40),
  amount       bigint not null check (amount > 0),
  category_id  uuid not null references public.categories (id),
  -- null = pick when paying (the app suggests the first account)
  account_id   uuid references public.accounts (id),
  -- 1–31; a bill due on the 31st is due on the last day of shorter months
  due_day      smallint not null check (due_day between 1 and 31),
  -- first month the bill is due (first day of that month)
  starts_on    date not null check (extract(day from starts_on) = 1),
  -- last month it's due, for installments; null = every month until ended
  ends_on      date check (ends_on is null or (extract(day from ends_on) = 1 and ends_on >= starts_on)),
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index bills_user_id_idx on public.bills (user_id);
create index bills_category_id_idx on public.bills (category_id);
create index bills_account_id_idx on public.bills (account_id);

alter table public.bills enable row level security;

create trigger set_updated_at before update on public.bills
  for each row execute function private.set_updated_at();

create policy "Own bills: read" on public.bills
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Own bills: add" on public.bills
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.categories c where c.id = category_id and c.user_id = (select auth.uid()))
    and (account_id is null or exists (select 1 from public.accounts a where a.id = account_id and a.user_id = (select auth.uid())))
  );

create policy "Own bills: update" on public.bills
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.categories c where c.id = category_id and c.user_id = (select auth.uid()))
    and (account_id is null or exists (select 1 from public.accounts a where a.id = account_id and a.user_id = (select auth.uid())))
  );

-- ---------------------------------------------------------------------------
-- 2. bill_payments: one per bill per month, paid (with its expense) or skipped
-- ---------------------------------------------------------------------------
create table public.bill_payments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  bill_id         uuid not null references public.bills (id) on delete cascade,
  month           date not null check (extract(day from month) = 1),
  -- the expense logged when it was paid; null = skipped that month
  transaction_id  uuid references public.transactions (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  unique (bill_id, month)
);

create index bill_payments_user_id_idx on public.bill_payments (user_id);
create index bill_payments_transaction_id_idx on public.bill_payments (transaction_id);

alter table public.bill_payments enable row level security;

create trigger set_updated_at before update on public.bill_payments
  for each row execute function private.set_updated_at();

create policy "Own bill payments: read" on public.bill_payments
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Own bill payments: add" on public.bill_payments
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.bills b where b.id = bill_id and b.user_id = (select auth.uid()))
    and (transaction_id is null or exists (select 1 from public.transactions t where t.id = transaction_id and t.user_id = (select auth.uid())))
  );

create policy "Own bill payments: update" on public.bill_payments
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.bills b where b.id = bill_id and b.user_id = (select auth.uid()))
    and (transaction_id is null or exists (select 1 from public.transactions t where t.id = transaction_id and t.user_id = (select auth.uid())))
  );

-- ---------------------------------------------------------------------------
-- 3. push_subscriptions: where to send "bill due today" notifications.
--    One row per device/browser. Not synced to the device's local copy.
--    The daily cron reads these with the service role key.
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "Own push subscriptions: read" on public.push_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Own push subscriptions: add" on public.push_subscriptions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Re-subscribing the same browser after logging in as someone else replaces the old row
create policy "Own push subscriptions: update" on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Own push subscriptions: remove" on public.push_subscriptions
  for delete to authenticated
  using (user_id = (select auth.uid()));
