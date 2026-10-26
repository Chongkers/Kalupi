-- Kalupi core tables (see docs/erd.md)
-- Tables are in dependency order: a table can only reference tables above it.
--
-- Money is stored as bigint centavos (₱125.50 = 12550).
-- updated_at / deleted_at support offline sync; a trigger that keeps
-- updated_at current comes in a later migration.
-- Foreign keys that must block deletes use the default (NO ACTION) rather than
-- RESTRICT: NO ACTION is checked at the end of the statement, so deleting an
-- account can still cascade through categories and their transactions together.
-- Row level security is enabled on every table; with no policies yet, the
-- Data API can't read or write anything until policies are added.

-- 1. profiles
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 2. categories
create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  name         text not null,
  kind         text not null check (kind in ('income', 'expense')),
  archived_at  timestamptz,
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (user_id, kind, name)
);

alter table public.categories enable row level security;

-- 3. trackers
create table public.trackers (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  target_amount  bigint not null check (target_amount > 0),
  target_date    date,
  -- set null: a shared tracker survives its creator deleting their account
  created_by     uuid references public.profiles (id) on delete set null,
  archived_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create index trackers_created_by_idx on public.trackers (created_by);

alter table public.trackers enable row level security;

-- 4. budgets
create table public.budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  month       date check (extract(day from month) = 1),  -- null = default template
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  -- nulls not distinct: also allows only one template (month is null) per user
  unique nulls not distinct (user_id, month)
);

alter table public.budgets enable row level security;

-- 5. budget_items
create table public.budget_items (
  id            uuid primary key default gen_random_uuid(),
  budget_id     uuid not null references public.budgets (id) on delete cascade,
  category_id   uuid not null references public.categories (id),
  limit_amount  bigint not null check (limit_amount >= 0),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  unique (budget_id, category_id)
);

create index budget_items_category_id_idx on public.budget_items (category_id);

alter table public.budget_items enable row level security;

-- 6. tracker_members
create table public.tracker_members (
  tracker_id  uuid not null references public.trackers (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null default 'editor' check (role in ('owner', 'editor')),
  joined_at   timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (tracker_id, user_id)
);

create index tracker_members_user_id_idx on public.tracker_members (user_id);

alter table public.tracker_members enable row level security;

-- 7. tracker_invites
create table public.tracker_invites (
  id           uuid primary key default gen_random_uuid(),
  tracker_id   uuid not null references public.trackers (id) on delete cascade,
  invited_by   uuid not null references public.profiles (id) on delete cascade,
  token        text not null unique default gen_random_uuid()::text,
  accepted_by  uuid references public.profiles (id) on delete set null,
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_at  timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index tracker_invites_tracker_id_idx on public.tracker_invites (tracker_id);

alter table public.tracker_invites enable row level security;

-- 8. transactions
create table public.transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  type         text not null check (type in ('income', 'expense', 'contribution', 'withdrawal')),
  amount       bigint not null check (amount > 0),
  category_id  uuid references public.categories (id),
  tracker_id   uuid references public.trackers (id),
  -- no default: the database runs on UTC, so the app always sends the local date
  occurred_on  date not null,
  note         text,
  source       text not null default 'manual' check (source in ('manual', 'preset', 'scan')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  -- income/expense belong to a category; contribution/withdrawal to a tracker
  check (
    (type in ('income', 'expense') and category_id is not null and tracker_id is null)
    or
    (type in ('contribution', 'withdrawal') and tracker_id is not null and category_id is null)
  )
);

create index transactions_user_occurred_on_idx on public.transactions (user_id, occurred_on);
create index transactions_user_updated_at_idx on public.transactions (user_id, updated_at);
create index transactions_category_id_idx on public.transactions (category_id);
create index transactions_tracker_id_idx on public.transactions (tracker_id);

alter table public.transactions enable row level security;

-- 9. presets
create table public.presets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  name         text not null,
  type         text not null check (type in ('income', 'expense', 'contribution', 'withdrawal')),
  amount       bigint not null check (amount > 0),
  category_id  uuid references public.categories (id),
  tracker_id   uuid references public.trackers (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  -- same rule as transactions, except the category or tracker may be left empty
  check (
    (type in ('income', 'expense') and tracker_id is null)
    or
    (type in ('contribution', 'withdrawal') and category_id is null)
  )
);

create index presets_user_id_idx on public.presets (user_id);
create index presets_category_id_idx on public.presets (category_id);
create index presets_tracker_id_idx on public.presets (tracker_id);

alter table public.presets enable row level security;
