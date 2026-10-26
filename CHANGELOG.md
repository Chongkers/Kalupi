# Kalupi patch notes

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
