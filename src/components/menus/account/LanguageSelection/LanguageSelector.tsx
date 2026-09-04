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
        <Label className="flex w-full max-w-full cursor-default text-black dark:text-white">{t('Language')}</Label>
        <Button
          id="language-selector-button"
          className="flex flex-auto cursor-default items-center rounded-lg border-0 bg-white/90 py-2 pr-2 pl-5 text-left text-base leading-normal text-gray-700 shadow-md ring-1 ring-black/5 outline-offset-3 outline-black transition focus:outline-hidden focus-visible:ring-black/25 focus-visible:outline-2 dark:bg-zinc-900 dark:text-gray-100 pressed:bg-white dark:pressed:bg-zinc-900"
        >
          <SelectValue className="flex-1 truncate" />
          <ChevronUpDownIcon className="h-4 w-4" />
        </Button>
        <Popover className="flex !max-h-80 w-(--trigger-width) flex-col rounded-md bg-white text-base shadow-lg ring-1 ring-black/5 dark:bg-zinc-700 entering:animate-in entering:fade-in exiting:animate-out exiting:fade-out">
          <Autocomplete filter={contains}>
            <SearchField
              aria-label={t('SearchLanguages')}
              autoFocus
              className="group m-1 flex items-center rounded-lg border-2 border-gray-300 bg-white has-focus:border-sky-600 dark:bg-zinc-900 forced-colors:bg-[Field]"
            >
              <MagnifyingGlassIcon aria-hidden className="ml-2 h-4 w-4 text-gray-600 forced-colors:text-[ButtonText]" />
              <Input
                placeholder={t('SearchLanguages')}
                className="min-w-0 flex-1 border-none bg-white px-2 py-1 font-[inherit] text-base text-gray-800 placeholder-gray-500 outline-0 dark:bg-zinc-900 dark:text-gray-100 [&::-webkit-search-cancel-button]:hidden"
              />
              <Button className="mr-1 flex w-6 items-center justify-center rounded-full border-0 bg-transparent p-1 text-center text-sm text-gray-600 transition group-empty:invisible hover:bg-black/[5%] dark:text-gray-200 pressed:bg-black/10">
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
