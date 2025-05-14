import React from 'react';

export interface ThemeContextProps {
  theme?: string;
  isLoading: boolean;
  updateTheme: (value: string) => void;
}

export const ThemeContext = React.createContext<ThemeContextProps>(undefined!);
export const useTheme = () => React.useContext(ThemeContext);
