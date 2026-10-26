# Launch checklist (Phase 11)

## 1. Database

In Supabase → SQL Editor, run `supabase/migrations/20261024000000_trackers_presets_launch.sql`.
It adds the custom monthly limit, preset archiving, the invite preview and the keep-alive `ping()`.

Run it before using the new screens: until it's in, saving a budget or preset is refused by the server.

## 2. Vercel

1. Push the project to GitHub (or run `npx vercel` from the project folder).
2. Import it in Vercel. Framework: Next.js (auto-detected).
3. Environment variables (Production and Preview):
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | same as `.env.local` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | same as `.env.local` |
   | `CRON_SECRET` | any long random string, e.g. from `openssl rand -hex 32` |
4. Deploy. The cron in `vercel.json` calls `/api/keep-alive` once a day (01:00 UTC).
   Check it under Project → Settings → Cron Jobs; "Run" should return `{"ok":true}`.

## 3. Supabase Auth URLs

Supabase → Authentication → URL Configuration:

- **Site URL**: `https://<your-app>.vercel.app`
- **Redirect URLs**: add `https://<your-app>.vercel.app/**` (keep `http://localhost:3000/**` for local work)

Without this, confirmation and password-reset emails link back to localhost.

## 4. Install on the phones

- **iPhone**: open the site in Safari → Share → Add to Home Screen.
- **Android**: open it in Chrome → menu → Install app.

Open it once online after installing so it can download your data; after that it works offline.
Do one screenshot scan online too, so the reader is saved for offline scans.

## 5. Smoke test

- [ ] Both people sign up and log in on their phones
- [ ] Airplane mode: add, edit and delete an entry; turn it off; check the other device
- [ ] Create a tracker, invite the other person, both add money, totals match on both phones
- [ ] Scan a GCash or bank screenshot and check the amount
- [ ] History shows last month's report; "Save as PDF" prints cleanly
