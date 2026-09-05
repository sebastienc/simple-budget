import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  prefersDarkQuery,
  resolveInitialPreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  ThemeContext,
  type ResolvedTheme,
  type ThemeContextProps,
  type ThemePreference,
} from './useTheme';

export interface ThemeProviderProps {
  children: React.ReactNode | React.ReactNode[];
}

const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Both resolved during the initial render, not in an effect, so the first
  // painted frame is already correct (index.html sets the class even earlier).
  const [preference, setPreference] = useState<ThemePreference>(resolveInitialPreference);
  const [theme, setTheme] = useState<ResolvedTheme>(() => resolveTheme(resolveInitialPreference()));

  useEffect(() => {
    setTheme(resolveTheme(preference));

    // Only listen while actually following the OS. An explicit light or dark
    // choice should stay put when the Mac switches over at sunset.
    if (preference !== 'system') {
      return;
    }
    const media = prefersDarkQuery();
    const followSystem = () => setTheme(resolveTheme('system'));
    media.addEventListener('change', followSystem);
    return () => media.removeEventListener('change', followSystem);
  }, [preference]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  }, [preference]);

  const updatePreference = useCallback((value: ThemePreference) => setPreference(value), []);

  const wrapper: ThemeContextProps = useMemo(() => ({ preference, theme, setPreference: updatePreference }), [preference, theme, updatePreference]);

  return <ThemeContext.Provider value={wrapper}>{children}</ThemeContext.Provider>;
};

export default ThemeProvider;
