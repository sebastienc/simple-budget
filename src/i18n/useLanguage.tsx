import React from 'react';

export interface LanguageContextProps {
  language?: string;
  isLoading: boolean;
  updateLanguage: (value: string) => void;
}

export const LanguageContext = React.createContext<LanguageContextProps>(undefined!);
export const useLanguage = () => React.useContext(LanguageContext);
