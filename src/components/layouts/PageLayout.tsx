import React from 'react';
import Titlebar from '../titlebar/Titlebar';

export interface PageLayoutProps {
  pageTitle: string;
  children: React.ReactNode | React.ReactNode[];
}

const PageLayout: React.FC<PageLayoutProps> = ({ pageTitle, children }) => {
  return (
    <div className="flex h-full w-full flex-col">
      <Titlebar pageTitle={pageTitle} />
      <div className="flex w-full flex-auto flex-row">
        <div id="content" className="flex h-full w-full flex-none flex-col">
          {children}
        </div>
      </div>
    </div>
  );
};

export default PageLayout;
