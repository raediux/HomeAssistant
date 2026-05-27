# Design Guide — Dark Household Dashboard

A reusable design system for personal dark-mode web apps. No framework, no build step — pure HTML, CSS, JS.

---

## Philosophy

- **Dark and warm.** The background leans slightly warm-dark (near-black with a hint of brown undertone, not pure #000 or cold blue-black).
- **Layered depth.** Three levels of surface lightness create hierarchy without color.
- **Glass, not flat.** Panels use `backdrop-filter: blur` + semi-transparent whites to feel frosted rather than opaque.
- **Ambient presence.** Colored radial glow bleeds behind key panels — very subtle, not neon.
- **Residential tone.** Readable at a distance, calm under dim room light. Avoid harsh whites or saturated UI chrome.
- **Lean stack.** HTML file + CSS file + JS files. CDN only for fonts, icons, and Supabase. Zero build tooling.

---

## CDN Dependencies

```html
<!-- Typography -->
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">

<!-- Icon set (Tabler Icons — outlined, consistent stroke weight) -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css">

<!-- Database (optional — only if using Supabase) -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

Icon usage: `<i class="ti ti-{name}"></i>` — e.g. `ti-plus`, `ti-pencil`, `ti-x`, `ti-chevron-left`, `ti-search`.

---

## Color System

All values live in `:root`. Always reference via `var(--token)` — never hardcode hex in components.

```css
:root {
  color-scheme: dark;

  /* ── Backgrounds ── */
  --bg:       #111110;   /* page/card fill — warm near-black */
  --surface:  #1c1c1a;   /* elevated surface (inputs, buttons) */
  --surface2: #242422;   /* hover state surface */

  /* ── Borders ── */
  --border:   #2e2e2b;   /* subtle dividers */
  --border2:  #3a3a36;   /* interactive borders (inputs, buttons) */

  /* ── Text ── */
  --text:     #e8e6e1;   /* primary — warm off-white */
  --text2:    #9e9b93;   /* secondary — muted */
  --text3:    #6b6960;   /* tertiary — disabled, placeholders, labels */

  /* ── Accent (blue) ── */
  --accent:   #4a8fd4;   /* interactive highlight, links, active state */
  --accent-l: #1a2d42;   /* accent background tint */
  --accent-t: #7ab3e8;   /* accent text on dark bg */

  /* ── Semantic colors ── */
  --green:    #5a9e5a;   --green-l:  #1a2e1a;
  --amber:    #c4903a;   --amber-l:  #2e2010;
  --red:      #c46060;   --red-l:    #2e1a1a;
  --pink:     #c46090;   --pink-l:   #2e1a28;
  --yellow:   #c9a838;   --yellow-l: #2e2710;

  /* ── Shape ── */
  --r:  8px;   /* standard border-radius */
  --rl: 12px;  /* large border-radius (modals, panels) */
}
```

### Semantic color pairs

Each color has a `-l` (light background tint) partner. Use them together: `background: var(--red-l); color: var(--red)`. Never use a saturated color on a dark surface without its tint pair.

| Token | Use |
|---|---|
| `--accent` / `--accent-l` | Active states, primary buttons, focus rings, selected items |
| `--green` / `--green-l` | Completed / success states |
| `--amber` / `--amber-l` | Warnings, move-to-archive actions |
| `--red` / `--red-l` | Delete actions, error states |
| `--pink` / `--pink-l` | Per-person accent (Jazelle) |
| `--yellow` / `--yellow-l` | Per-person accent (Linus) |

---

## Typography

**Family:** `DM Sans` — geometric, clean, slightly warm. Fallback: `system-ui, sans-serif`.

```css
font-family: 'DM Sans', system-ui, sans-serif;
font-size: 14px;   /* base */
color: var(--text);
```

### Scale

| Use | Size | Weight | Color |
|---|---|---|---|
| App title / clock | 22–32px | 600 | `--text` |
| Section/modal heading | 14–18px | 600 | `--text` |
| Body / card title | 13px | 500 | `--text` |
| Secondary body | 12–13px | 400 | `--text2` |
| Labels, badges, meta | 10–11px | 500–600 | `--text2` / `--text3` |
| Uppercase labels | 10–11px | 600 + `text-transform: uppercase` + `letter-spacing: .06-.08em` | `--text3` |

### Special: tabular numbers (clock)

```css
font-variant-numeric: tabular-nums;
letter-spacing: 0.05em;
```

Use this on any live-updating numeric display to prevent layout shift.

---

## Spacing & Radius

No spacing scale variables — spacing is applied directly. Common values in use:

| Context | Value |
|---|---|
| Component internal padding | `10–16px` |
| Gap between cards | `6px` |
| Gap between columns | `10px` |
| Section/panel padding | `16–24px` |
| Topbar padding | `13px 22px` |
| Small gap (icon + label) | `5–8px` |

Border radius:
- `--r` (8px) — inputs, buttons, cards, small panels
- `--rl` (12px) — modals, large panels, shopping panel
- `5px` — tight contexts (calendar day, inline buttons)
- `20px` — pills, filter tags, ghost buttons

---

## Background Recipe

```css
body {
  background:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E"),
    radial-gradient(ellipse at 65% 0%, #10131a 0%, #0d0e12 45%, #0c0d10 100%);
}
```

- **Layer 1 (top):** SVG fractal noise at 6% opacity — adds subtle film grain texture.
- **Layer 2 (bottom):** Radial gradient with origin at top-right; very dark blue-black → near-black. Gradient origin can shift per app personality.
- The `--bg` token (#111110) is a warm near-black used for card fills. The body gradient is slightly cooler/bluer — the contrast between warm card surfaces and a cool background adds depth.

---

## Glassmorphism Pattern

Used for topbar, tab bar, columns, modals, detail panels.

### Levels

| Level | Background | Border | Blur |
|---|---|---|---|
| Topbar / tab bar | `rgba(255,255,255,0.025–0.03)` | `rgba(255,255,255,0.07)` | `blur(8px)` |
| Column panels | `rgba(255,255,255,0.04)` | `rgba(255,255,255,0.07)` | `blur(16px)` |
| Modal | `rgba(28,28,26,0.88)` | `rgba(255,255,255,0.1)` | `blur(16px)` |
| Detail panel | `rgba(255,255,255,0.035)` | `rgba(255,255,255,0.07)` | `blur(16px)` |

Always pair `-webkit-backdrop-filter` with `backdrop-filter` for Safari support.

### Top edge highlight

Panels get a slightly brighter top border to simulate a light source from above:

```css
border: 1px solid rgba(255,255,255,0.07);
border-top: 1px solid rgba(255,255,255,0.12–0.15);
```

For per-person columns, the top border is tinted with the person's accent color at ~50% opacity:
```css
border-top: 4px solid rgba(74,143,212,0.5);   /* blue — Ray */
border-top: 4px solid rgba(196,96,144,0.5);   /* pink — Jazelle */
border-top: 4px solid rgba(201,168,56,0.45);  /* yellow — Linus */
```

---

## Ambient Glow Technique

A blurred colored orb is placed behind each column using a `::before` pseudo-element on a wrapper div. The glow never touches the column directly — it sits in a separate wrapper.

```html
<div class="col-glow-wrap col-glow-ray">
  <div class="person-column col-ray"> ... </div>
</div>
```

```css
.col-glow-wrap {
  position: relative;
  flex: 1;
}
.col-glow-wrap::before {
  content: '';
  position: absolute;
  width: 280px;
  height: 280px;
  top: -80px;
  left: -60px;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(70px);
  z-index: 0;
}
/* Column inside must be z-index: 1 to sit above the glow */
.person-column { position: relative; z-index: 1; }

/* Per-column color — keep opacity very low (0.1–0.22) */
.col-glow-ray::before    { background: radial-gradient(circle, rgba(74,143,212,0.22) 0%, transparent 70%); }
.col-glow-jazelle::before { background: radial-gradient(circle, rgba(196,96,144,0.15) 0%, transparent 70%); }
.col-glow-linus::before  { background: radial-gradient(circle, rgba(201,168,56,0.11) 0%, transparent 70%); }
```

**Rule:** Keep glow opacity below 0.25 and blur above 60px. Higher opacity or sharper blur reads as neon, not ambient.

---

## App Shell

```css
html, body {
  height: 100vh;
  overflow: hidden;       /* no page scroll — panels scroll internally */
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 14px;
  min-width: 1080px;      /* desktop-first, no mobile breakpoints */
}
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
```

Tab panels are `display: none` by default, `display: flex; flex-direction: column` when `.active`. The topbar and tab bar are `flex-shrink: 0`; the active panel is `flex: 1; min-height: 0` to fill remaining space.

---

## Components

### Topbar

```css
.topbar {
  background: rgba(255,255,255,0.025);
  border-bottom: 1px solid rgba(255,255,255,0.07);
  backdrop-filter: blur(8px);
  padding: 13px 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
```

### Tab Bar

```css
.tab-bar {
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid rgba(255,255,255,0.07);
  backdrop-filter: blur(8px);
  padding: 0 22px;
  display: flex;
  flex-shrink: 0;
}
.tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 11px 18px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text2);
  cursor: pointer;
  transition: color .12s, border-color .12s;
  margin-bottom: -1px;   /* overlaps panel border for clean active underline */
}
.tab:hover  { color: var(--text); }
.tab.active { color: var(--text); border-bottom-color: var(--text2); }
```

### Buttons

Three button types:

```css
/* Standard */
.btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 13px;
  border-radius: var(--r);
  border: 1px solid var(--border2);
  background: var(--surface);
  color: var(--text);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: background .12s;
}
.btn:hover { background: var(--surface2); }

/* Primary (accent-filled) */
.btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.btn-primary:hover { background: #3a7abf; }

/* Ghost (pill shape) */
.btn-ghost {
  background: none;
  border: 1px solid var(--border2);
  border-radius: 20px;
  padding: 4px 11px;
  font-size: 11px;
  color: var(--text2);
  cursor: pointer;
  transition: border-color .12s, color .12s;
}
.btn-ghost:hover { border-color: var(--text3); color: var(--text); }

/* Icon button (inline, no bg) */
.ib {
  background: none;
  border: none;
  cursor: pointer;
  padding: 3px 5px;
  border-radius: 5px;
  font-size: 14px;
  color: var(--text2);
  transition: background .12s, color .12s;
}
.ib:hover        { background: var(--surface2); color: var(--text); }
.ib.active       { color: var(--accent); background: var(--accent-l); }
.ib.del:hover    { background: var(--red-l); color: var(--red); }
```

### Badges

```css
.badge {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 20px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}

/* Color variants — always bg + text pair */
.b-blue { background: var(--accent-l); color: var(--accent-t); }
.b-red  { background: var(--red-l);    color: var(--red);      }
.b-amb  { background: var(--amber-l);  color: var(--amber);    }
.b-grn  { background: var(--green-l);  color: var(--green);    }
.b-gray { background: var(--surface2); color: var(--text2); border: 1px solid var(--border); }
```

### Filter Pills

```css
.filter-bar { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 14px; }
.fp {
  padding: 4px 12px;
  border-radius: 20px;
  border: 1px solid var(--border2);
  background: var(--surface);
  color: var(--text2);
  font-size: 11px;
  cursor: pointer;
  transition: all .12s;
}
.fp:hover  { background: var(--surface2); color: var(--text); }
.fp.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.fp-sep    { width: 1px; background: var(--border); align-self: stretch; margin: 0 2px; }
```

### Task Card

```css
.task-card {
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.07);
  border-left: 2px solid rgba(255,255,255,0.15); /* colored per-person */
  border-radius: var(--r);
  padding: 10px 13px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  transition: border-color .12s;
  cursor: pointer;
  min-height: 56px;
}
.task-card:hover { border-color: var(--border2); }
.task-card.done  { opacity: .35; }
.task-card.done .card-title { text-decoration: line-through; }

/* Left border color per person */
.col-ray     .task-card { border-left-color: var(--accent); }
.col-jazelle .task-card { border-left-color: var(--pink); }
.col-linus   .task-card { border-left-color: var(--yellow); }
```

Done state: `opacity: 0.35` + `text-decoration: line-through`. Never hide completed items — ghost them.

### Checkbox Circle

```css
.circle {
  width: 14px; height: 14px;
  border-radius: 50%;
  border: 1.5px solid var(--border2);
  flex-shrink: 0;
  margin-top: 2px;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px;
  cursor: pointer;
  transition: border-color .12s;
}
.circle:hover  { border-color: var(--accent); }
.circle.checked { background: var(--green-l); border-color: var(--green); color: var(--green); }
```

### Modal

```css
.modal-overlay {
  display: none;
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(4px);
  z-index: 1000;
  align-items: center; justify-content: center;
}
.modal-overlay.open { display: flex; }

.modal-box {
  background: rgba(28,28,26,0.88);
  border: 1px solid rgba(255,255,255,0.1);
  border-top: 1px solid rgba(255,255,255,0.15);
  border-radius: var(--rl);
  padding: 24px;
  width: 380px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5);
  backdrop-filter: blur(16px);
}

/* Form elements inside modal */
.modal-lbl {
  display: block;
  font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: .05em;
  color: var(--text2);
  margin-bottom: 5px;
}
.modal-input {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border2);
  border-radius: var(--r);
  padding: 8px 11px;
  font-size: 13px;
  color: var(--text);
  font-family: inherit;
  outline: none;
  transition: border-color .12s;
}
.modal-input:focus { border-color: var(--accent); }

/* Footer with action buttons */
.modal-ftr {
  display: flex; justify-content: flex-end; gap: 8px;
  margin-top: 20px; padding-top: 16px;
  border-top: 1px solid var(--border);
}
```

### Search Bar

```css
.search-bar {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 7px 11px;
  margin-bottom: 12px;
}
.search-bar i     { color: var(--text3); font-size: 15px; }
.search-bar input {
  background: none; border: none; outline: none;
  font-size: 13px; color: var(--text); flex: 1;
  font-family: inherit;
}
.search-bar input::placeholder { color: var(--text3); }
```

### Collapsible Category Section

```css
.cat-header {
  display: flex; align-items: center; gap: 8px;
  cursor: pointer; padding: 7px 0;
}
.cat-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: var(--text3); }
.cat-line  { flex: 1; height: 1px; background: var(--border); }
.cat-chevron { color: var(--text3); font-size: 13px; transition: transform .2s; }
.cat-chevron.collapsed { transform: rotate(-90deg); }
.cat-body.collapsed { display: none; }
```

Pattern: label + flex-growing line + item count + chevron. The line visually ties the label to the edge of the container.

### Drop Zone

```css
.drop-zone {
  border: 1.5px dashed var(--border2);
  border-radius: var(--r);
  padding: 14px;
  text-align: center;
  font-size: 12px; color: var(--text3);
  margin-bottom: 5px;
  display: none;   /* hidden until drag starts */
}
.drop-zone.active {
  display: block;
  border-color: var(--accent);
  color: var(--accent-t);
  background: var(--accent-l);
}
```

### Scrollbar

```css
::-webkit-scrollbar       { width: 5px; }
::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }
```

Thin, borderless, matches the dark surface. No track background.

---

## Animations & Transitions

### Standard transition duration: `.12s`

Apply to: background, color, border-color, opacity. Use on hover and active states. Do not animate layout properties (width, height, padding) — they cause reflow.

```css
transition: background .12s;
transition: color .12s, border-color .12s;
transition: opacity .12s;
```

### Shake (PIN error)

```css
@keyframes pin-shake {
  0%,100% { transform: translateX(0); }
  20%     { transform: translateX(-8px); }
  40%     { transform: translateX(8px); }
  60%     { transform: translateX(-6px); }
  80%     { transform: translateX(6px); }
}
/* Apply: element.classList.add('shake') then remove after 350ms */
```

### Chevron rotate (collapse)

```css
transition: transform .2s;
.collapsed { transform: rotate(-90deg); }
```

---

## Interaction State Reference

| State | Visual treatment |
|---|---|
| Hover (button/card) | Background lightens one surface level (`--surface` → `--surface2`) |
| Focus (input) | `border-color: var(--accent)` |
| Active/selected | `background: var(--accent-l); color: var(--accent)` or `var(--accent-t)` |
| Done/completed | `opacity: 0.35` + strikethrough on text |
| Dragging | `opacity: 0.4; border-style: dashed` |
| Drag-over target | `border-color: var(--accent); background: var(--accent-l)` |
| Delete hover | `background: var(--red-l); color: var(--red)` |
| Add/confirm hover | `background: var(--green-l); color: var(--green)` |
| Error visible | `opacity: 1` (error text normally `opacity: 0`, transitions in) |

---

## Vertical Sidebar Label

Used for task section labels (Daily / Weekly / Occasional) — rotated text as a space-efficient side label:

```css
.row-label {
  width: 28px;
  padding: 14px 8px;
  font-size: 11px; font-weight: 500;
  color: var(--text3);
  background: rgba(0,0,0,0.2);
  border-right: 1px solid rgba(255,255,255,0.06);
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  display: flex; align-items: center; justify-content: center;
}
```

---

## PIN Overlay Pattern

Full-screen lock screen using `position: fixed; inset: 0`. Dismissed by setting `.hidden` class. The overlay shares `--bg` as its background so it's indistinguishable from the app background.

```css
#pin-overlay { position: fixed; inset: 0; background: var(--bg); z-index: 9999; display: flex; align-items: center; justify-content: center; }
#pin-overlay.hidden { display: none; }
```

---

## Starting Template

Minimal HTML shell to start a new app with this design system:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>App Name</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css">
<link rel="stylesheet" href="styles.css">
</head>
<body>
<div class="app">
  <div class="topbar">
    <div class="topbar-title">App Name</div>
  </div>
  <div class="tab-bar">
    <button class="tab active" onclick="switchTab('home')">Home</button>
    <button class="tab" onclick="switchTab('other')">Other</button>
  </div>
  <div class="tab-panel active" id="panel-home">
    <!-- content -->
  </div>
  <div class="tab-panel" id="panel-other">
    <!-- content -->
  </div>
</div>
<script>
function switchTab(id) {
  document.querySelectorAll('.tab').forEach((t,i) => t.classList.toggle('active', t.textContent.toLowerCase() === id));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + id));
}
</script>
</body>
</html>
```

Minimum CSS to paste into `styles.css` for the shell to work: paste the `:root`, `html/body`, `body` background, `.app`, `.topbar`, `.tab-bar`, `.tab`, `.tab-panel` blocks from this guide.
