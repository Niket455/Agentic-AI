# FinTracker

An **offline-first Progressive Web App** for personal finance — track budgets, expenses, income,
savings, debts, goals, and a wishlist. Everything runs in the browser with no backend and no
network required after the first load.

## Features

- **Dashboards & reports** — monthly overview, category breakdowns, budget-vs-actual, and savings
  growth, all drawn on `<canvas>` (no charting library).
- **Budgets** — per-category monthly budgets with progress and threshold notifications.
- **Expenses / income / savings / debts / goals / wishlist** — the full personal-finance set.
- **Custom month start day** — monthly rollups honor a configurable start day.
- **PIN lock** — optional app lock screen.
- **Offline-first** — a service worker caches the app shell (cache-first), so it works with no
  connection and is installable to a home screen.
- **Backup/restore** — export/import data as JSON.
- **Currency** — defaults to `₹` (Indian formatting: K / L / Cr).

## Project layout

| Path | Role |
|---|---|
| `index.html` | App shell: header, bottom nav, lock screen, modal/toast roots |
| `css/style.css` | Styling and theming (CSS variables, dark theme) |
| `js/db.js` | Data layer: `localStorage` state, defaults, migration, formatting helpers |
| `js/app.js` | Views, routing, and app logic |
| `js/charts.js` | Lightweight canvas charts (pie/donut, bar, grouped bar, line) |
| `manifest.json` | PWA manifest (name, icons, standalone display) |
| `sw.js` | Service worker (install/activate/fetch, cache-first) |

## Data model

All state lives under the `localStorage` key `fintracker_v1`:

```text
settings         currency, theme, monthStartDay, notifications, pin
categories       {id, name, budget, color, icon, archived, createdAt}
expenses         {id, catId, amount, date, time, note, tags[], recurring, receipt}
savingsSections  {id, name, color, icon, archived}
savingsEntries   {id, sectionId, amount, date, note, time}
incomes          {id, source, amount, date, note}
debts            {id, name, type, amount, paid, note}   # loan | credit | borrowed | lent
goals            {id, name, target, saved, targetDate}
wishlist         {id, item, price, targetDate, saved}
meta             {lastReminder, notified{}}
```

`DB.migrate()` backfills any missing keys from the defaults, so older saves keep working.

## Run

Serve the folder over HTTP (a plain `file://` open disables the service worker):

```bash
cd fintracker
python -m http.server 8080
```

Then open <http://localhost:8080>. To test the PWA install/offline behavior, use a browser's
"Install" action and toggle offline in DevTools.

## Notes

- Data is **per-browser** (localStorage). Use **export/import** to move or back up data.
- Clearing site data will erase all records; export a backup first.
