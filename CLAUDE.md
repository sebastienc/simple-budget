# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production (TypeScript check + Vite build)
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Architecture Overview

**Tech Stack:** React 19 + TypeScript + Vite, TailwindCSS v4, React Aria Components, Firebase (Auth/Firestore), i18next, React Router DOM v7

**Provider Hierarchy:** The app uses nested context providers in this order:
```
ThemeProvider → LanguageProvider → FirebaseProvider → FirebaseAuthProvider → FirebaseFirestoreProvider → ToasterProvider → BrowserRouter
```

**Authentication Flow:** 
- Google OAuth via Firebase Auth
- Protected routes wrapped with `AuthenticatedPage` component
- Automatic redirect to sign-in for unauthenticated users
- Last known URL preservation using `useRedirectToLastKnownUrl` hook
- Main navigation logic in `App.tsx`

**Component Organization:**
- Feature-based folders (`/auth`, `/home`) 
- Reusable components in `/components` with type-based subfolders (`/buttons`, `/icons`, `/menus`, etc.)
- Layout components: `AuthenticatedPageLayout`, `Titlebar`
- Conditional rendering: `IsVisibleWhen`, `DisplayIf`, `IsHiddenWhen`

**Internationalization:**
- English (`en-US`) and French (`fr-CA`) support
- Configuration in `/src/i18n/config.ts` and `/src/i18n/supportedLanguages.ts`
- Auto-detection with localStorage persistence
- Translation files: `/src/i18n/{lang}/translation.json`

**Theming:**
- Dark/light mode with system preference detection
- CSS class-based theming (`dark` class on `documentElement`)
- Theme state managed by `ThemeProvider` and persisted in localStorage

**Firebase Integration:**
- Configuration in `FirebaseProvider.tsx` (credentials currently hardcoded - recommend environment variables)
- Firestore rules in `/firestore.rules` (currently deny all - needs proper rules for production)
- Firestore indexes in `/firestore.indexes.json`

**Path Aliases:** 
- `#/*` maps to `./src/*` (configured in package.json imports)

**Key Files:**
- `/src/main.tsx` - Provider setup and app initialization
- `/src/routes.tsx` - Route definitions
- `/src/App.tsx` - Main navigation logic and auth flow