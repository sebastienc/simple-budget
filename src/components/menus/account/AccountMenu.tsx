import { Button, Menu, MenuTrigger, Popover, Separator } from 'react-aria-components';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import AccountMenuItem from './AccountMenuItem';
import DarkModeSwitch from './Theme/DarkModeSwitch';
import LanguageSelector from './LanguageSelection/LanguageSelector';

const AccountMenu = () => {
  return (
    <div className="inline-flex h-full w-full items-center justify-center border-b-2 border-solid border-slate-400 bg-slate-300 dark:bg-zinc-900">
      <MenuTrigger>
        <Button
          id="account-menu-trigger"
          aria-label="Settings"
          className="inline-flex cursor-default items-center justify-center rounded-md border-none bg-transparent p-1.5 text-white outline-hidden transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 dark:hover:bg-zinc-800 pressed:bg-gray-300 dark:pressed:bg-zinc-700"
        >
          <Cog6ToothIcon className="h-7 w-7" />
        </Button>
        <Popover className="origin-top-left overflow-auto rounded-sm bg-white p-2 shadow-lg ring-1 ring-black/10 outline-hidden fill-mode-forwards dark:bg-zinc-900 dark:ring-white/15 entering:animate-in entering:fade-in entering:placement-top:slide-in-from-bottom-1 entering:placement-bottom:slide-in-from-top-1 exiting:animate-out exiting:fade-out exiting:placement-top:slide-out-to-bottom-1 exiting:placement-bottom:slide-out-to-top-1">
          <div className="mx-3 mt-2 flex flex-col gap-1">
            <DarkModeSwitch>Dark Mode</DarkModeSwitch>
          </div>
          <Separator className="mx-3 mt-4 mb-2 h-[1px] border-none bg-gray-300 dark:bg-zinc-600" />
          <LanguageSelector />
          <Separator className="mx-3 mt-4 mb-2 h-[1px] border-none bg-gray-300 dark:bg-zinc-600" />
          <Menu className="outline-hidden">
            <AccountMenuItem id="account-settings">Account Settings</AccountMenuItem>
            <AccountMenuItem id="support">Support</AccountMenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
    </div>
  );
};

export default AccountMenu;
