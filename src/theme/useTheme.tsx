import React from 'react';

/** What the user chose. `system` means "follow the OS, and keep following it". */
export type ThemePreference = 'light' | 'dark' | 'system';
/** What that choice resolves to right now. */
export type ResolvedTheme = 'light' | 'dark';

export const THEME_PREFERENCES: ThemePreference[] = ['light', 'dark', 'system'];

export interface ThemeContextProps {
  preference: ThemePreference;
  theme: ResolvedTheme;
  setPreference: (value: ThemePreference) => void;
}

export const ThemeContext = React.createContext<ThemeContextProps>(undefined!);
export const useTheme = () => React.useContext(ThemeContext);

export const THEME_STORAGE_KEY = 'selectedTheme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Defaults to following the OS. Anything unrecognised — including the absence
 * of a stored value on a fresh install — means "system" rather than a guess at
 * light or dark.
 */
export function resolveInitialPreference(): ThemePreference {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== 'system') {
    return preference;
  }
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

export function prefersDarkQuery(): MediaQueryList {
  return window.matchMedia(DARK_QUERY);
}
