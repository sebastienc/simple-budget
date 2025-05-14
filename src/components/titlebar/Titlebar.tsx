import React from 'react';
import ActionMenu from '@/components/menus/action/ActionMenu';
import AccountMenu from '@/components/menus/account/AccountMenu';

export interface TitlebarProps {
  pageTitle: string;
}

const Titlebar: React.FC<TitlebarProps> = ({ pageTitle }) => {
  return (
    <div id="titleBar" className="flex h-16 flex-grow flex-row gap-2 border-b-2 border-solid border-slate-400 bg-slate-300 dark:bg-zinc-900 dark:text-gray-100">
      <div className="flex h-16 w-32 flex-none items-center justify-center">
        <ActionMenu />
      </div>
      <div className="flex flex-grow items-center justify-center text-2xl font-bold">
        <span>{pageTitle}</span>
      </div>
      <div className="flex h-16 w-32 flex-none items-center justify-center">
        <AccountMenu />
      </div>
    </div>
  );
};

export default Titlebar;
