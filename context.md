# Home Assistant — Project Context

## What's built

A dark-mode household dashboard for Ray, Jazelle, and Linus. Vanilla HTML/CSS/JS — no frameworks. Served on GitHub Pages at `https://raediux.github.io/HomeAssistant`.

## Features complete

- 3×3 grid layout — rows are Daily/Weekly/Occasional (vertical labels), columns are the three people
- Each person-box has a 3-column internal task grid
- Tasks: add, edit, delete, toggle done — all behind a per-person edit mode toggle (pencil icon)
- Due date badges on occasional tasks (overdue/today/amber/upcoming colour coding)
- Day-of-week selector on weekly tasks (Mon–Sun pill buttons)
- Shopping tab — working list + past purchases, drag-to-archive, category grouping
- PIN auth overlay (SHA-256 hashed, sessionStorage so you only enter once per session)

## Backend

- Supabase project connected with three tables: `tasks`, `shopping_working`, `shopping_past`
- `db.js` handles all reads/writes; local arrays act as client-side cache (optimistic UI)
- Pushed to GitHub, GitHub Pages live

## Current blocker

Tasks (and likely shopping items) aren't persisting on refresh — waiting on RLS to be disabled on the three Supabase tables via the SQL editor:

```sql
alter table tasks disable row level security;
alter table shopping_working disable row level security;
alter table shopping_past disable row level security;
```

## Not started yet

- Calendar tab (currently shows "coming soon")
- Real-time sync via Supabase (so changes on one device appear on another without refresh)

## File structure

| File | Purpose |
|---|---|
| `index.html` | App shell, tab panels, modals |
| `styles.css` | All styling, CSS variables, dark theme |
| `ui.js` | Tab switching, shopping logic, PIN auth |
| `tasks.js` | Task state, rendering, modal logic |
| `db.js` | All Supabase read/write functions |
| `config.js` | Supabase URL/key, PIN hash |
| `schema.sql` | Supabase table definitions (run once in SQL editor) |
