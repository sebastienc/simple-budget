import React from 'react';
import AccountMenu from '@/components/menus/account/AccountMenu';

export interface AppBarProps {
  /** Context controls for the current screen, e.g. the account switcher. */
  toolbar?: React.ReactNode;
}

const AppBar: React.FC<AppBarProps> = ({ toolbar }) => (
  <header className="sticky top-0 z-10 flex h-14 flex-none items-center justify-between gap-4 border-b border-rule bg-surface px-5">
    <div className="flex min-w-0 items-center gap-2 overflow-x-auto">{toolbar}</div>
    <AccountMenu />
  </header>
);

export default AppBar;
