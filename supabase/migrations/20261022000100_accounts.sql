-- Accounts: where money actually sits (cash, bank, e-wallet), plus transfers
-- between them. See docs/erd.md.
--
-- Account balance  = income - expense + transfers in - transfers out
-- Available to spend = all account balances - (contributions - withdrawals)
-- Contributions earmark money for a tracker without moving it out of the account.

-- 1. accounts
create table public.accounts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  name         text not null,
  kind         text not null check (kind in ('cash', 'bank', 'ewallet')),
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (user_id, name)
);

alter table public.accounts enable row level security;

-- 2. transactions: every transaction uses an account; transfers also name a destination
alter table public.transactions
  add column account_id uuid not null references public.accounts (id),
  add column to_account_id uuid references public.accounts (id);

alter table public.transactions drop constraint transactions_type_check;
alter table public.transactions drop constraint transactions_check;

alter table public.transactions
  add constraint transactions_type_check
    check (type in ('income', 'expense', 'contribution', 'withdrawal', 'transfer')),
  add constraint transactions_links_check check (
    (type in ('income', 'expense')
      and category_id is not null and tracker_id is null and to_account_id is null)
    or
    (type in ('contribution', 'withdrawal')
      and tracker_id is not null and category_id is null and to_account_id is null)
    or
    (type = 'transfer'
      and to_account_id is not null and to_account_id <> account_id
      and category_id is null and tracker_id is null)
  );

create index transactions_account_id_idx on public.transactions (account_id);
create index transactions_to_account_id_idx on public.transactions (to_account_id);

-- 3. presets: optional default account (null = the app picks the last one used)
alter table public.presets
  add column account_id uuid references public.accounts (id);

create index presets_account_id_idx on public.presets (account_id);
