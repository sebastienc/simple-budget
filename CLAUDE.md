# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Simple Budget is a local-only, single-device Electron budgeting app (React + TypeScript + SQLite) built around a day-by-day cash-flow projection. See `.claude/rules/` for architecture details — they load automatically for the relevant files. See `ROADMAP.md` for what's built and what was deliberately dropped.

## Development Commands

- `npm run dev` - Start Electron + Vite dev server (hot reload)
- `npm run build` - Build for production (TypeScript check + electron-vite build)
- `npm run dist` - Build and package as a distributable app (electron-builder)
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build
