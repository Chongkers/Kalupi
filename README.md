# Kalupi

Personal budget and savings tracker for two users. Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, with Supabase for auth and Postgres. Installable as a PWA with offline sync.

## How data flows

- Screens read from an on-device copy of your data (IndexedDB via Dexie, [src/lib/local/](src/lib/local/)), so they work offline.
- Every change is saved locally and queued in an outbox; [sync.ts](src/lib/local/sync.ts) pushes the outbox to Supabase in order when online, then pulls rows changed elsewhere (by `updated_at`).
- Balances and budgets are calculated on the device by [src/lib/finance/](src/lib/finance/).
- The service worker ([src/app/sw.ts](src/app/sw.ts), Serwist) caches the app itself. It's off in `npm run dev`; use `npm run build && npm start` to try offline mode.

- Data model: [docs/erd.md](docs/erd.md)
- Original UI (Thymeleaf, reference only): [templates/](templates/)

## Run locally

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the Supabase values
3. `npm run dev` and open http://localhost:3000
