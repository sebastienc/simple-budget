/** @jsxRuntime automatic @jsxImportSource react */
// This file lives outside src/, the only directory covered by a tsconfig
// that sets the automatic JSX runtime — the pragma above gets both tsc and
// esbuild to use it here too, since ambient tsconfig settings don't apply to
// a file outside every project's `include`.
import type { ReactElement, ReactNode } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import ThemeProvider from '../src/theme/ThemeProvider';
import LanguageProvider from '../src/i18n/LanguageProvider';
import ToasterProvider from '../src/toast/ToasterProvider';

/**
 * Mirrors main.tsx's provider stack, minus routing — component tests render
 * a screen directly rather than through the full router. Reserve this for
 * components that actually call useLanguage()/useTheme() themselves (e.g.
 * LanguageSelector, AppearanceControl): LanguageProvider resolves its
 * language from localStorage in an effect, which remounts its subtree once
 * as that settles — components that don't need it should use
 * renderWithToaster instead, which doesn't have that wrinkle.
 */
function AllProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <ToasterProvider>{children}</ToasterProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export function renderWithProviders(ui: ReactElement): RenderResult {
  return render(ui, { wrapper: AllProviders });
}

/**
 * For components that call useToaster() (addToast) but don't touch
 * language/theme context directly — most of src/home's panels. Lighter than
 * renderWithProviders and without its remount-on-mount wrinkle.
 */
export function renderWithToaster(ui: ReactElement): RenderResult {
  return render(ui, { wrapper: ToasterProvider });
}
