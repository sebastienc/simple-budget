---
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
---

# Frontend (src)

**Provider hierarchy** (`src/main.tsx`): `ThemeProvider → LanguageProvider → ToasterProvider → BrowserRouter → RouterProviderWrapper` (wraps React Aria's `RouterProvider` around `react-router-dom`'s `Routes`, defined in `src/routes.tsx`). No auth — nothing to protect, the app is local-only.

**Routing** (`src/routes.tsx`): `/` redirects to `/home`, `/home` renders `Home`, everything else renders a 404 page.

**Organization:**
- `/src/home` — the whole app UI (account setup, recurring items, projection, net worth)
- `/src/data` — fetch-based hooks over `/api/*`, one per resource (`useAccounts`, `useRecurringItems`, `useBalanceCheckpoints`, `useProjection`, `useNetWorth`, `useBackup`)
- `/src/components` — reusable, type-based subfolders: `/buttons`, `/menus`, `/toast`, `/drawer`, `/layouts`, `/errors`, `/conditions` (`IsVisibleWhen`, `DisplayIf`, `IsHiddenWhen`)

**Internationalization:** English (`en`) and French (`fr`) resource bundles registered as `en-US`/`fr-CA` locales. Config in `/src/i18n/config.ts`, translations at `/src/i18n/{en,fr}/translation.json`. Translation keys are PascalCase (e.g. `EndDate`, `SinkingFundTotal`) — add new keys to both files, same position.

**Theming:** dark/light mode with system-preference detection, persisted to `localStorage` (`selectedTheme`), applied via a `dark` class on `documentElement`. State in `ThemeProvider`/`useTheme` (`/src/theme`).
