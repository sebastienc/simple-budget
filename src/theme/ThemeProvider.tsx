import React, { useEffect, useMemo, useState } from 'react';
import { ThemeContext, type ThemeContextProps } from './useTheme';

export interface ThemeProviderProps {
  children: React.ReactNode | React.ReactNode[];
}

const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [theme, setTheme] = useState<string>('light');

  useEffect(() => {
    if (!theme) {
      const localTheme = window.localStorage.getItem('selectedTheme');
      if (!localTheme) {
        const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (isDarkMode) {
          setTheme('dark');
        } else {
          setTheme('light');
        }
      } else {
        setTheme(localTheme);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.localStorage.setItem('selectedTheme', 'dark');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      window.localStorage.setItem('selectedTheme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      window.localStorage.setItem('selectedTheme', 'light');
    }
    setIsLoading(false);
  }, [theme]);

  const updateTheme = (value: string): void => {
    setIsLoading(true);
    setTheme(value);
  };

  const wrapper: ThemeContextProps = useMemo(
    () => ({
      theme,
      isLoading,
      updateTheme,
    }),
    [theme, isLoading],
  );

  return (
    <ThemeContext.Provider value={wrapper}>
      <>{children}</>
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
