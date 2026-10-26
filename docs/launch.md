# Launch checklist (Phase 11)

## 1. Database

In Supabase → SQL Editor, run each migration once, in order:

1. `supabase/migrations/20261024000000_trackers_presets_launch.sql`: custom monthly limit, preset archiving, invite preview, keep-alive `ping()`.
2. `supabase/migrations/20261026000000_v1_0_1.sql` (v1.0.1): category icons and colors, profile pictures (creates the `avatars` storage bucket).
3. `supabase/migrations/20261027000000_avatar_url_check.sql` (v1.0.1 fix): profile pictures can only link to the user's own file.
4. `supabase/migrations/20261028000000_v1_0_3_settle_up.sql` (v1.0.3): settle-up trackers, split people and shares, payback entry types.

Run them before using the new screens: until they're in, the server refuses the new kinds of changes (budgets, presets, category icons, pictures, settle-up trackers).

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

Then Supabase → Authentication → Emails, for each template below: set the subject, paste the file's contents as the body, and save.

| Template | Subject | Body |
|---|---|---|
| Confirm signup | Confirm your Kalupi account | `supabase/templates/confirm-signup.html` |
| Reset password | Reset your Kalupi password | `supabase/templates/reset-password.html` |

These use `token_hash` links, which work on any device. Supabase's default `code` links only work in the browser that asked for the email, so opening one on another phone or in the Gmail app shows "That link expired".

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

## 6. Deleting an account (on request)

Settings → Delete account opens an email to `CONTACT_EMAIL` ([src/lib/legal.ts](../src/lib/legal.ts)). The Privacy Policy promises it's done within 7 days.

1. Check the request came **from the account's own email**. If it didn't, reply asking them to send it from that address.
2. Supabase → Authentication → Users → find the email → **Delete user**. This deletes their profile and, through `on delete cascade`, all their accounts, categories, budgets, transactions, presets, tracker memberships, invites and settle-up data.
   - Shared trackers they **created** stay for the other members, but have no owner (nobody can archive them). Their contributions disappear, so the tracker total goes down.
3. Supabase → Storage → `avatars` → delete the folder named after their user id (their profile picture), if there is one.
4. Reply to confirm it's done.

Their devices still hold a local copy until they log out there; the next sync fails because the account is gone.
