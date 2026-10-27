# Kalupi MVP Roadmap

**Goal:** a usable MVP installed on both phones: log money in and out per account offline, stay inside a monthly budget, and save toward a tracker shared with a friend.

**Architecture:** Next.js PWA on Vercel · Supabase (Postgres, Auth, RLS) · Dexie (IndexedDB) offline store with an outbox sync · shadcn/ui · Tesseract.js. See [erd.md](erd.md).

**Owner tags** (suggested; change freely): `[you]` you write it with a guide from Claude · `[claude]` Claude writes it (repetitive or setup work).

---

## Phase 0: Foundation

- [x] ERD and data model decisions
- [x] Next.js 16 + TypeScript + Tailwind scaffold
- [x] shadcn/ui with the Kalupi palette, Inter, dark mode
- [x] Supabase project, env vars, client/server/proxy helpers
- [x] Migration 1: core tables
- [x] Migration 2: accounts and transfers
- [x] Migration 3: RLS policies, triggers, `accept_invite`, `tracker_progress`
- [ ] Security Advisor shows no errors; test sign-up creates profile + 12 categories
- [ ] Git repository and first commit `[claude]`
- [x] Review mockup PDF; update design tokens to match `[claude]`
- [ ] Email: connect Resend SMTP **or** turn off email confirmation `[you]`

## Phase 1: Auth

- [x] Login page `[you]`
- [x] Signup page with display name `[you]`
- [x] Forgot / reset password flow (`/auth/confirm` route) `[claude]`
- [x] Logout
- [x] Redirect logged-out users to login (in `proxy.ts`) `[claude]`

## Phase 2: App shell

- [x] Mobile layout with bottom navigation: Dashboard · Transactions · Trackers · History `[claude]`
- [x] Settings page: display name, theme, logout `[claude]`
- [x] Money helpers: centavos ↔ "₱1,234.50", parsing typed amounts `[you]`
- [x] Date helpers: today in Asia/Manila, month start/end `[you]`

## Phase 3: Setup wizard

- [x] Shown on first login (no accounts yet)
- [x] Step 1: add accounts (cash, bank, e-wallet) with starting balances → "Opening balance" transactions
- [x] Step 2: default budget template (limit per expense category)

## Phase 4: Transactions (online first)

- [x] Add transaction drawer: type, amount, account, category, date, note `[you]`
- [x] Transfer between accounts
- [x] Transaction list grouped by day, with search and filter `[claude]`
- [x] Edit and delete (soft delete) `[you]`
- [x] Manage categories and accounts: add, rename, archive `[claude]`
- [x] Account balances and available balance (derived, never stored) `[you]`

## Phase 5: Budget and guardrail

- [x] Opening a month with no budget copies the template
- [x] Dashboard: available balance, account balances, budget used (total + per category)
- [x] Guardrail: warn before saving an expense that goes over a category limit, the total, or available balance `[you]`
- [x] Edit the current month's budget

## Phase 6: Offline-first and PWA

- [x] Web app manifest, icons, installable on Android and iOS `[claude]`
- [x] Service worker caching the app shell (Serwist) `[claude]`
- [x] Dexie local database mirroring the synced tables `[claude]`
- [x] Outbox: every write saved locally + queued `[you]`
- [x] Push: send the outbox in order when online, retry on failure `[you]`
- [x] Pull: fetch rows with `updated_at` newer than the last sync `[you]`
- [x] Screens read from Dexie instead of Supabase `[claude]`
- [x] Sync status indicator: synced / offline / N changes pending `[claude]`
- [x] Extend sync to every table (same pattern) `[claude]`
- [ ] Test: airplane mode on, add/edit/delete, airplane mode off, check the other device

## Phase 7: Trackers and sharing (MVP goal)

- [x] Create tracker: name, target, optional date
- [x] Contribute and withdraw from an account
- [x] Progress bar and per-member totals from `tracker_progress()` (cached for offline)
- [x] Share: create invite link, send via the phone's share sheet
- [x] `/invite/[token]` page: log in if needed, then accept
- [x] Members list; leave; owner removes members, archives tracker
- [ ] Test with two accounts: invite, join, both contribute, check totals on both phones

## Phase 8: Presets

- [x] Create, edit, archive presets
- [x] One-tap logging from the dashboard (with optional amount change)

## Phase 9: History

- [x] Month picker
- [x] Monthly report (based on `report.html`): income, expenses, net, budget used
- [x] Edit past transactions and past budgets
- [x] Custom overall monthly limit (optional; otherwise the sum of category limits)

## Phase 10: Screenshot scan

- [x] Pick a screenshot from the gallery `[claude]`
- [x] Tesseract.js reads the text in the browser; language file cached for offline `[claude]`
- [x] Extract the ₱ amount `[you]` (written by Claude in `src/lib/finance/scan.ts`; worth reading and tuning against your own screenshots)
- [x] Confirm screen prefilled with the amount; saved with `source = scan`; image not kept
- [ ] Test with real GCash / Maya / bank screenshots

## Phase 11: Launch

- [ ] Run migration `20261024000000_trackers_presets_launch.sql` in Supabase (before using the new features)
- [ ] Deploy to Vercel with env vars `[claude]` (steps in [launch.md](launch.md))
- [ ] Supabase Auth: Site URL and redirect URLs set to the Vercel domain
- [x] Daily keep-alive cron so the free project never pauses `[claude]` (`vercel.json` + `/api/daily`; needs `CRON_SECRET`)
- [x] Automated tests (Vitest, `npm test`): money, dates, budget, guardrail, trackers, scan, and the local mutations
- [ ] Install on both phones (iOS: Safari → Share → Add to Home Screen; Android: Install app)
- [ ] One week of real use; fix what comes up

---

## MVP is done when

- [ ] Both of you can sign up, log in, and stay logged in on your phones
- [ ] Transactions can be logged offline and appear on the other device after reconnecting
- [ ] Account balances and the monthly budget are correct after a week of real use
- [ ] One shared tracker shows both people's contributions
- [ ] A bank screenshot fills in the amount correctly most of the time

## Version 1.0.3: Settle-up trackers

**Goal:** after a night out where you paid for everyone (or a friend paid for you), see who owes what and log it when they pay you back. Friends don't need the app.

A new tracker asks: **settling up after an event**, or **saving up for something**? Saving trackers work as before. Settle-up trackers are personal for now (no invites); friends are names you type in.

**Money rules** (details in [erd.md](erd.md)):
- You paid a ₱1,000 bill split four ways: your account goes down ₱1,000, your budget counts only your ₱250, and ₱750 is owed to you.
- A friend paid and your share is ₱250: your budget counts ₱250 and you owe them ₱250. No account changes until you pay them back.
- Paybacks (`settle_in`, `settle_out`) move money in or out of an account but are never income or spending.

- [ ] Run migration `20261028000000_v1_0_3_settle_up.sql` in Supabase (before deploying)
- [x] Tracker kind (`goal` | `split`); settle-up trackers have no target and can't be shared yet
- [x] People on a settle-up tracker: add, rename, remove (once settled)
- [x] Add a bill: what for, amount, category, who paid, split equally or by exact amounts
- [x] Balances: total owed to you and that you owe, per person
- [x] Settle up with someone, fully or partly, into or out of an account
- [x] Copy or share a reminder message ("You owe ₱250 for Boracay trip")
- [x] Budget, dashboard and history count your share of split bills, not the full amount
- [x] Tests for the split math and the mutations
- [ ] Test: a real night out with friends, settle everyone, check balances and budget

**Later (1.1):** shared settle-up trackers. Link a name to a Kalupi account via the invite link, everyone in the group sees the bills, either side can record a payment, and debts are simplified (A→B→C becomes A→C).

## Version 1.3.0 (planned): Monthly bills

**Goal:** see what's coming before it's due (rent, load, internet, Spotify, SPayLater) and log a bill in one tap when you pay it.

**How it works (proposed):**
- A bill has a name, amount, category, account, due day of the month (1–31; a 31st bill is due on the last day of short months) and an optional end date or number of payments, for things like installments.
- Bills are reminders, not entries: nothing touches your balance until you tap **Paid**. That logs a normal expense with today's date and the bill's details (amount editable, like a preset), and marks that month's bill as paid.
- Available balance stays real money. A new **"After bills"** figure shows available minus the bills still unpaid this month.
- The dashboard gets an **Upcoming bills** card: due soon, overdue in red, and paid with a check.
- The budget can show bills as already committed, so "Safe to spend ₱X a day" leaves room for them.

**Data:** a `bills` table (synced like presets) and a `bill_payments` table (bill, month, transaction), so each month's paid or unpaid status syncs across devices.

- [ ] Migration: `bills`, `bill_payments`, RLS (owner only)
- [ ] Add, edit, pause and end bills (Settings → Bills)
- [ ] Due dates per month, including short months, end dates and installment counts
- [ ] Dashboard "Upcoming bills" card and an "After bills" figure
- [ ] Pay a bill: logs the expense, links it, can be undone by deleting the entry
- [ ] Budget: count unpaid bills as committed in "Safe to spend"
- [ ] Optional: a browser notification the day before a bill is due (needs push, see below)
- [ ] Tests for due-date math and paying or unpaying a bill

## After the MVP

- Push notifications (over budget, friend contributed, bill due)
- Charts and spending trends
- Recurring income (salary, allowance), the same way as bills
- CSV export
- CSV export
- Native app wrapper (Capacitor) if the PWA isn't enough
