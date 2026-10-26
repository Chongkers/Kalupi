# Kalupi patch notes

## 1.0.3 · October 26, 2026

### New
- **Settle-up trackers.** Paid for everyone after a night out, or a friend paid for you? When you make a new tracker, choose **Settling up after an event** instead of **Saving up for something**. Add your friends by name (they don't need Kalupi), then add the bills.
- **Add a bill.** Enter what it was for, the amount, the category and who paid, then split it equally or by exact amounts. Kalupi works out who owes whom.
- **Settle up.** When someone pays you back (or you pay them), record all or part of it and pick the account the money went into or came out of.
- **Reminders.** Copy or share a message like "You owe ₱250 for Boracay trip".
- **Owed to you** now shows on the Trackers page, across all your settle-up trackers.
- **Terms and Privacy Policy.** When you sign up, you'll tick a box to agree to the Terms and Conditions and the Privacy Policy. Tap either one to read it in a pop-up without leaving the page. You can read them again any time in **Settings → Terms and privacy**.
- **Delete your account.** Go to **Settings → Delete account** to send a deletion request by email. Your account and all its data are deleted within 7 days, and you'll get a reply when it's done.

### Improved
- **Your budget counts only your share.** If you paid a ₱1,000 bill split four ways, your account goes down ₱1,000 but your budget, dashboard and History count only your ₱250. Paybacks move money in or out of an account but never count as income or spending.
- **New login and sign-up look**, with a dark brand panel.

### Fixed
- Logging out no longer flashes the setup wizard.
- Logging out now fully clears your data from the device, even if a sync was running at the time.
- **Email links work anywhere.** The confirm-your-email and reset-password links used to fail with "That link expired" when opened on a different phone or browser, or in the Gmail app. They now work wherever you open them.

### For the database
- Run `supabase/migrations/20261028000000_v1_0_3_settle_up.sql` in Supabase before using 1.0.3. It adds settle-up trackers, the people and shares on them, and the payback entry types.
- In Supabase → Authentication → Emails, replace the **Confirm signup** and **Reset password** templates with the ones in `supabase/templates/`.

## 1.0.1 · October 26, 2026

### New
- **Icons for every category.** Each category now has its own color-coded icon: Food gets a fork and knife, Transportation a bus, Salary a briefcase, and so on. Categories you add get a matching icon automatically (Milk tea gets a drink, Rent a house). To pick a different icon or color, go to **Settings → Categories** and tap the icon.
- **Icons for accounts.** Cash, bank and e-wallet accounts each have their own icon and color, on the dashboard and in Settings → Accounts.
- **Category icons everywhere.** You'll see them in your transactions, budget bars, the History report, Quick add, and when you pick a category.
- **Profile pictures.** Add a PNG, JPG, WebP or GIF picture in **Settings → Profile**. It's cropped to a square and shrunk before upload, and your tracker partners see it next to your name.
- **Presets in Add entry.** Your presets now show at the top of the Add entry screen. Tap one to fill in the amount, category, account and note, then change anything before saving.
- **Choose your budget style at setup.** New accounts choose between **one total** for the month and **a limit per category**.

### Improved
- **Budget page:** "Edit limits" now has the wide column, with the category inputs two across on bigger screens. This month's status and the per-category bars sit beside it (above it on phones), so there's much less scrolling.
- **Settings:** removed the empty space under Email in the Profile card.
- The app version now shows at the bottom of Settings.

### For the database
- Run `supabase/migrations/20261026000000_v1_0_1.sql` in Supabase before using 1.0.1. It adds category icons and colors, profile pictures and the `avatars` storage bucket.

## 1.0.0 · October 24, 2026

First release: accounts, transactions, budgets with an optional overall limit, shared savings trackers with invite links, presets with Quick add, monthly History reports, screenshot scanning, and offline sync.
