# Design-sync notes

## Project shape
- Plain JS Vite app (no TypeScript, no Storybook). Uses `componentSrcMap` in
  config.json to map all 15 components explicitly (the converter's `.d.ts`
  discovery finds nothing here).
- Library build: `vite.lib.config.js` + `src/components/index.js` barrel →
  `dist-lib/index.js`. Pass `--entry ./dist-lib/index.js` to the converter.
- CSS: `ds-bundle-combined.css` = `tokens.css` + `reset.css` + `shared.css` +
  `dist-lib/index.css`, in that order. **shared.css is essential** — it holds
  `.modal-overlay`/`.modal-box`/`.btn`/`.dow-*` global classes; without it the
  modals render as black boxes (overlay defaults to `display:none`).

## Critical gotchas (cost hours — don't repeat)

### `_ds_needs_recompile` is JSON, not a flag
Must be written from the bundle file via `localPath` — content is
`{"by":"design-sync-cli"}`. The app parses the `by` key to rebuild
`_ds_manifest.json` and thumbnails. Writing raw `"1"`/`"0"`/timestamps breaks
the JSON parse → the app's self-check fails silently → NO manifest, NO
thumbnails regenerate, every card goes blank. If thumbnails vanish, this is why.

### The design tool renders BARE components for thumbnails
It does NOT use the `_preview/*` wrappers (MockProviders etc.) for the card
thumbnail — it renders `window.HomeAssistant.<Name>` with no props/providers.
So any component reading `useHousehold()`/`useUndo()` crashed on a null context
and rendered blank. Fix: `HouseholdContext`/`UndoContext` `createContext()`
defaults now carry safe mock data (3 members, no-op scheduleDelete). These apply
ONLY outside a provider; the real app always mounts inside both providers
(main.jsx), whose `value=` overrides them — live behaviour unchanged.

### Single-story components need `cardMode: "single"`
Authored previews default to a grid/cell layout with a "DEFAULT" label on top,
which pushes the component below the thumbnail crop (looks blank/white). Floor
cards render full-bleed and look right. For single-story components set
`overrides.<Name>.cardMode = "single"` in config.json → full-bleed render.
Currently single: Calendar, MealPlanner, Tasks, Shopping, Whiteboard, Topbar,
Weather, Auth. Multi-story (grid is correct): TabBar(3), ColorPicker(2),
TaskModal(2), ShoppingModal(2).

### Framer-motion modals render black in static capture
TaskModal/ShoppingModal use `initial={{opacity:0}}` + IIFE-bundled framer-motion;
`MotionConfig reducedMotion` can't reach across the bundle boundary. Their
previews are authored as **static HTML mockups** using the real `.modal-box`/
`.modal-input`/`.dow-*` classes (see `previews/TaskModal.tsx`,
`previews/ShoppingModal.tsx`) — not the live component.

## Floor cards (no live preview, acceptable)
- ShoppingWorkingPanel / ShoppingPastPanel — items use `animate={controls}`
  (useAnimation) with no `controls.start()` on mount, so they stay invisible
  regardless of MockProviders/MotionConfig. The full `Shopping` component has a
  good preview that shows the layout.

## Re-sync risks
- Always rebuild lib (`vite build --config vite.lib.config.js`) before the
  converter, and rebuild `ds-bundle-combined.css` (tokens+reset+shared+lib).
- Upload close-out: sentinel (localPath) → files → sentinel (localPath) →
  `_ds_sync.json` last. Never invent sentinel content.
