import React from 'react';
import { useLanguage } from '../../i18n/useLanguage';
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { t } from 'i18next';

const Languages: React.FC = () => {
  const { updateLanguage, language } = useLanguage();
  
  const setLanguage = (value: string) => {
    updateLanguage(value);
  }

  return (
    <DropdownMenuRadioGroup value={language ?? 'en'} onValueChange={setLanguage}>
      <DropdownMenuRadioItem value="en">{t('English')}</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="fr">{t('French')}</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  )
};

export default Languages;
