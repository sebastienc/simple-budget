import type { ListBoxItemProps } from 'react-aria-components';
import { ListBoxItem } from 'react-aria-components';
import { CheckIcon } from '@heroicons/react/24/solid';

function LanguageSelectItem(props: ListBoxItemProps & { children: string }) {
  return (
    <ListBoxItem
      {...props}
      textValue={props.children}
      className="group flex cursor-default items-center gap-2 rounded-md px-3 py-2 text-sm text-ink outline-hidden select-none focus:bg-accent-soft focus:text-accent"
    >
      {({ isSelected }) => (
        <>
          <span className="flex flex-1 items-center gap-2 truncate font-normal group-selected:font-medium">{props.children}</span>
          <span className="flex w-5 items-center text-accent">{isSelected && <CheckIcon className="h-4 w-4" />}</span>
        </>
      )}
    </ListBoxItem>
  );
}

export default LanguageSelectItem;
