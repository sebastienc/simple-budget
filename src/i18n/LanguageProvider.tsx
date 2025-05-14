import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { I18nProvider, useLocale } from 'react-aria-components';
import { LanguageContext } from './useLanguage';

import type { LanguageContextProps } from './useLanguage';

export interface LanguageProviderProps {
  children: React.ReactNode | React.ReactNode[];
}

const getAriaLanguage = (language: string): string => {
  switch (language) {
    case 'en':
      return 'en-US';
    case 'fr':
      return 'fr-CA';
    default:
      return 'en-US';
  }
};

const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [language, setLanguage] = useState<string>();
  const [ariaLanguage, setAriaLanguage] = useState<string>();
  const { i18n } = useTranslation();
  const { locale, direction } = useLocale();

  useEffect(() => {
    setIsLoading(true);
    const localLang = window.localStorage.getItem('i18nextLng');
    if (!localLang) {
      console.log('localLang is not good: ', localLang);
      setLanguage('en');
    } else {
      console.log('localLang is good: ', localLang);
      setLanguage(localLang);
    }
  }, []);

  useEffect(() => {
    console.log('setting langauge to: ', language);
    if (!language) {
      return;
    }
    setAriaLanguage(getAriaLanguage(language));
    window.localStorage.setItem('i18nextLng', language);
    i18n.changeLanguage(language);
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const updateLanguage = (value: string): void => {
    console.log('updating language to: ', value);
    setIsLoading(true);
    setLanguage(value);
  };

  const wrapper: LanguageContextProps = useMemo(
    () => ({
      language,
      isLoading,
      updateLanguage,
    }),
    [language, isLoading],
  );

  return (
    <I18nProvider locale={ariaLanguage}>
      <LanguageContext.Provider value={wrapper}>
        <div lang={locale} dir={direction}>
          <>{children}</>
        </div>
      </LanguageContext.Provider>
    </I18nProvider>
  );
};

export default LanguageProvider;
