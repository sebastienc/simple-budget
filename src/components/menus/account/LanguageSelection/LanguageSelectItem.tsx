import type { ListBoxItemProps } from 'react-aria-components';
import { ListBoxItem } from 'react-aria-components';
import { CheckIcon } from '@heroicons/react/24/solid';

function LanguageSelectItem(props: ListBoxItemProps & { children: string }) {
  return (
    <ListBoxItem
      {...props}
      textValue={props.children}
      className="group flex cursor-default items-center gap-2 rounded-sm px-4 py-2 text-gray-900 outline-hidden select-none focus:bg-sky-600 focus:text-white dark:text-gray-100"
    >
      {({ isSelected }) => (
        <>
          <span className="flex flex-1 items-center gap-2 truncate font-normal group-selected:font-medium">{props.children}</span>
          <span className="flex w-5 items-center text-sky-600 group-focus:text-white dark:text-sky-100">{isSelected && <CheckIcon className="h-4 w-4" />}</span>
        </>
      )}
    </ListBoxItem>
  );
}

export default LanguageSelectItem;
