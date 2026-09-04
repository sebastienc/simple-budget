import React from 'react';
import AppBar from './AppBar';

export interface PageLayoutProps {
  toolbar?: React.ReactNode;
  children: React.ReactNode | React.ReactNode[];
}

const PageLayout: React.FC<PageLayoutProps> = ({ toolbar, children }) => (
  <div className="flex h-full w-full flex-col bg-surface text-ink">
    <AppBar toolbar={toolbar} />
    <main className="flex-auto overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-8">{children}</div>
    </main>
  </div>
);

export default PageLayout;
