import React from 'react';
import { Button, Menu, MenuTrigger, Popover, Separator } from 'react-aria-components';
import { Bars3Icon } from '@heroicons/react/24/solid';
import ActionMenuItem from './ActionMenuItem';

const ActionMenu: React.FC = () => {
  return (
    <div className="inline-flex h-full w-full items-center justify-center border-b-2 border-solid border-slate-400 bg-slate-300 dark:bg-zinc-900">
      <MenuTrigger>
        <Button
          id="action-menu-trigger"
          aria-label="Menu"
          className="inline-flex cursor-default items-center justify-center rounded-md border-none bg-transparent p-1.5 text-black outline-hidden transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-slate-100 dark:hover:bg-zinc-800 pressed:bg-gray-300 dark:pressed:bg-zinc-700"
        >
          <Bars3Icon className="h-6 w-6" />
        </Button>
        <Popover className="w-56 origin-top-left overflow-auto rounded-md bg-white p-2 shadow-lg ring-1 ring-black/10 outline-hidden fill-mode-forwards dark:bg-zinc-900 dark:ring-white/15 entering:animate-in entering:fade-in entering:zoom-in-95 exiting:animate-out exiting:fade-out exiting:zoom-out-95">
          <Menu className="outline-hidden">
            <ActionMenuItem id="new">New…</ActionMenuItem>
            <ActionMenuItem id="open">Open…</ActionMenuItem>
            <Separator className="mx-3 my-1 h-[1px] bg-gray-300" />
            <ActionMenuItem id="save">Save</ActionMenuItem>
            <ActionMenuItem id="save-as">Save as…</ActionMenuItem>
            <Separator className="mx-3 my-1 h-[1px] bg-gray-300" />
            <ActionMenuItem id="print">Print…</ActionMenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
    </div>
  );
};

export default ActionMenu;
