import React from 'react';

export type Theme = 'light' | 'dark';

export interface ThemeContextProps {
  theme: Theme;
  isLoading: boolean;
  updateTheme: (value: Theme) => void;
}

export const ThemeContext = React.createContext<ThemeContextProps>(undefined!);
export const useTheme = () => React.useContext(ThemeContext);

export const THEME_STORAGE_KEY = 'selectedTheme';

/**
 * The theme to start in: an explicit stored choice wins, otherwise follow the
 * OS. Kept in one place because `index.html` runs the same logic inline before
 * first paint to avoid a flash of the wrong theme.
 */
export function resolveInitialTheme(): Theme {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
