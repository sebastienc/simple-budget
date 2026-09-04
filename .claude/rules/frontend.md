---
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
---

# Frontend (src)

**Design tokens — use these, never literal palette colours.** `src/index.css` defines the palette as
CSS variables (`--surface`, `--ink`, `--ink-2`, `--rule`, `--accent`, `--warn`, `--danger`, …) flipped
by the `.dark` class, exposed to Tailwind via `@theme inline`. That means `bg-surface`, `text-ink-2`,
`border-rule` work in **both themes with no `dark:` variant** — there are deliberately zero
hand-written `dark:` colour variants left in the codebase, and no `gray-*`/`zinc-*`/`slate-*`/
`blue-*` literals. `--warn` (a projected shortfall) and `--danger` (a destructive control) are
semantic and stay distinct from `--accent`.

**Fonts** are self-hosted via `@fontsource` and imported in `src/main.tsx` — the app must render with
no network. `font-display` is Fraunces (headlines), `font-sans` Public Sans, `font-mono` IBM Plex
Mono (all figures, with `tabular-nums`).

**Shared code — check here before writing a helper:**
- `src/lib/dates.ts` — `todayISO()` (local, **not** UTC), `toISODate()`, `formatISODate()`. Display
  formatting resolves the date-fns locale from the active language; `toISODate` deliberately doesn't
  (it's a machine format for the API).
- `src/lib/money.ts` — `formatCents()` / `formatCentsSigned()` / `formatCentsAxis()` are locale-aware
  via `Intl`; `parseAmountToCents()` and `centsToInputValue()` for form round-tripping.
- `src/lib/projection.ts` — `summarizeProjection(days)` derives the lowest point, first negative day
  and upcoming events from the projection response. No backend call needed for any of it.
- `src/components/ui/` — `Button` (variants `primary | ghost | link | danger`), `TextField`, `Panel`,
  `Money`, `Badge`. A Button's `className` is **additive only**; needing a different fill means
  adding a variant, not overriding from the call site.
- `src/components/charts/BalanceChart.tsx` — hand-authored SVG step chart, no charting dependency.

**Layout:** `PageLayout` (frame + centred column) wraps `AppBar` (account switcher slot + settings
menu). `src/home` holds the whole app UI: `AccountHero` states the projection's conclusion in words,
`BalanceChart` shows its shape, then `RecurringItemsPanel` / `UpcomingPanel` / `ProjectionTable` /
`BalanceCheckpointsPanel`. `Home` fetches the projection once and passes it down — don't re-fetch it
per component.

**Data:** `src/data/*` are fetch hooks over `/api/*`, one per resource. Each takes an optional
`refreshToken` so a component that doesn't own the mutations can re-read after a sibling changes
something.

**Internationalization:** English (`en`) and French (`fr`), registered as `en-US`/`fr-CA`. Keys are
PascalCase in `/src/i18n/{en,fr}/translation.json` — add to **both**, same position. Where markup has
to sit inside a sentence (a coloured amount), use `<Trans>` rather than splicing strings: word order
differs between the two languages. `Frequency*` and `SortBy*` keys are built dynamically, so a grep
won't find them — don't prune them.

**Theming:** `ThemeProvider` resolves the initial theme during the first render (stored choice, then
OS preference); `index.html` runs the same logic inline before paint to avoid a flash. `color-scheme`
is set on `:root`/`.dark` so native scrollbars and date pickers follow the theme.
