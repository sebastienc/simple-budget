import React from 'react';
import { Autocomplete, Button, Input, Label, ListBox, Popover, SearchField, Select, SelectValue, type Key, useFilter } from 'react-aria-components';
import { ChevronUpDownIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/solid';
import LanguageSelectItem from './LanguageSelectItem';
import { useTranslation } from 'react-i18next';
import { supportedLanguages } from '@/i18n/supportedLanguages';
import { useLanguage } from '@/i18n/useLanguage';

const LanguageSelector: React.FC = () => {
  const { t } = useTranslation();
  const { contains } = useFilter({ sensitivity: 'base' });
  const { language, updateLanguage, isLoading: isLanguageLoading } = useLanguage();
  const selectedKey = language ?? 'en';

  const handleSelection = (key: Key | null) => {
    if (key && typeof key === 'string') {
      updateLanguage(key);
    }
  };

  return (
    <div className="mx-3 mt-2 flex max-w-full flex-col">
      <Select className="flex w-full max-w-full flex-col gap-1" selectedKey={selectedKey} isDisabled={isLanguageLoading} onSelectionChange={handleSelection}>
        <Label className="flex w-full max-w-full cursor-default text-xs font-medium tracking-wide text-ink-2">{t('Language')}</Label>
        <Button
          id="language-selector-button"
          className="flex flex-auto cursor-default items-center justify-between rounded-md border border-rule-strong bg-surface-raised px-3 py-2 text-left text-sm text-ink outline-hidden transition focus-visible:ring-2 focus-visible:ring-accent"
        >
          <SelectValue className="flex-1 truncate" />
          <ChevronUpDownIcon className="h-4 w-4" />
        </Button>
        <Popover className="flex !max-h-80 w-(--trigger-width) flex-col rounded-lg border border-rule bg-surface-raised text-sm shadow-lg entering:animate-in entering:fade-in exiting:animate-out exiting:fade-out">
          <Autocomplete filter={contains}>
            <SearchField
              aria-label={t('SearchLanguages')}
              autoFocus
              className="group m-1 flex items-center rounded-md border border-rule-strong bg-surface-raised has-focus:border-accent forced-colors:bg-[Field]"
            >
              <MagnifyingGlassIcon aria-hidden className="ml-2 h-4 w-4 text-ink-3 forced-colors:text-[ButtonText]" />
              <Input
                placeholder={t('SearchLanguages')}
                className="min-w-0 flex-1 border-none bg-transparent px-2 py-1 font-[inherit] text-sm text-ink placeholder-ink-3 outline-0 [&::-webkit-search-cancel-button]:hidden"
              />
              <Button className="mr-1 flex w-6 items-center justify-center rounded-full border-0 bg-transparent p-1 text-center text-sm text-ink-3 transition group-empty:invisible hover:text-ink">
                <XMarkIcon aria-hidden className="h-4 w-4" />
              </Button>
            </SearchField>
            <ListBox items={supportedLanguages} className="flex-1 scroll-pb-1 overflow-auto p-1 outline-hidden" selectionMode="single">
              {(item) => <LanguageSelectItem id={item.value}>{item.name}</LanguageSelectItem>}
            </ListBox>
          </Autocomplete>
        </Popover>
      </Select>
    </div>
  );
};

export default LanguageSelector;
