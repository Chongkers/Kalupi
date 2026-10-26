# Kalupi

Personal budget and savings tracker for two users. Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, with Supabase for auth and Postgres. Installable as a PWA with offline sync.

## How data flows

- Screens read from an on-device copy of your data (IndexedDB via Dexie, [src/lib/local/](src/lib/local/)), so they work offline.
- Every change is saved locally and queued in an outbox; [sync.ts](src/lib/local/sync.ts) pushes the outbox to Supabase in order when online, then pulls rows changed elsewhere (by `updated_at`).
- Balances and budgets are calculated on the device by [src/lib/finance/](src/lib/finance/).
- The service worker ([src/app/sw.ts](src/app/sw.ts), Serwist) caches the app itself. It's off in `npm run dev`; use `npm run build && npm start` to try offline mode.

- Data model: [docs/erd.md](docs/erd.md)
- Original UI (Thymeleaf, reference only): [templates/](templates/)

## Versions

Newest first. Each version that changes the database has a migration in [supabase/migrations/](supabase/migrations/); run it in the Supabase SQL Editor before deploying that version.

### 1.0.3

Migration: [20261028000000_v1_0_3_settle_up.sql](supabase/migrations/20261028000000_v1_0_3_settle_up.sql). Also paste the email templates in [supabase/templates/](supabase/templates/) into Supabase (see [docs/launch.md](docs/launch.md)).

- Settle-up trackers: a new tracker asks whether you're settling up after an event or saving up for something. Settle-up trackers list the friends (names you type in), the bills, and who owes what.
- Add a bill: what it was for, amount, category, who paid, split equally or by exact amounts.
- Settle up with someone, fully or partly, into or out of an account; copy or share a reminder ("You owe ₱250 for Boracay trip").
- Budget, dashboard and history count only your share of a split bill. Paybacks move money in or out of an account but never count as income or spending.
- Trackers page shows the total owed to you across settle-up trackers.
- Terms and Conditions and Privacy Policy: sign-up now needs an "I agree" tick; both open in a modal from sign-up and from Settings → Terms and privacy. The account records which version was agreed to and when (user metadata `terms_version`, `terms_accepted_at`).
- Delete account in Settings: for now it emails a deletion request to the contact address in [src/lib/legal.ts](src/lib/legal.ts); the steps for handling one are in [docs/launch.md](docs/launch.md). In-app deletion comes later.
- Login and sign-up screens have a new dark brand panel.
- Fix: logging out no longer flashes the setup wizard, and sync can't download your data back onto the device after logout wipes it.
- Fix: email confirmation and password reset links work on any device or browser, not just the one that asked for the email.

### 1.0.1

Migrations: [20261026000000_v1_0_1.sql](supabase/migrations/20261026000000_v1_0_1.sql), then [20261027000000_avatar_url_check.sql](supabase/migrations/20261027000000_avatar_url_check.sql)

- Category icons and colors: pick them in Settings → Categories; categories you haven't styled get one guessed from their name. Accounts get an icon by type.
- Profile pictures: add, change or remove one in Settings. It's shrunk on the phone before upload and shown in the account menu and on shared trackers.
- Setup wizard: budget the month as one total instead of a limit per category.
- Add entry: presets appear in the form; one tap fills it in.
- Budgets and History: wider layout with the category list two across on larger screens; budget rows show the category icon and turn red when over.
- Transaction list and trackers show category icons and member pictures.

### 1.0.0

First release (the MVP in [docs/roadmap.md](docs/roadmap.md)): accounts, transactions, monthly budget with guardrail, offline sync, shared trackers, presets, history reports and screenshot scan.

## Run locally

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the Supabase values
3. `npm run dev` and open http://localhost:3000
