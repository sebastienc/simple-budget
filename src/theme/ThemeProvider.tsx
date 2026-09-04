import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveInitialTheme, THEME_STORAGE_KEY, ThemeContext, type Theme, type ThemeContextProps } from './useTheme';

export interface ThemeProviderProps {
  children: React.ReactNode | React.ReactNode[];
}

const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Resolved during the initial render, not in an effect, so the first painted
  // frame is already the right theme (index.html sets the class even earlier).
  const [theme, setTheme] = useState<Theme>(resolveInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const updateTheme = useCallback((value: Theme) => setTheme(value), []);

  const wrapper: ThemeContextProps = useMemo(() => ({ theme, isLoading: false, updateTheme }), [theme, updateTheme]);

  return <ThemeContext.Provider value={wrapper}>{children}</ThemeContext.Provider>;
};

export default ThemeProvider;
