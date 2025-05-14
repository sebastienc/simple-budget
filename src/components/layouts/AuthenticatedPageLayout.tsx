import React from 'react';
import Titlebar from '../titlebar/Titlebar';
import AuthenticatedPage from '../AuthenticatedPage';

export interface AuthenticatedPageLayoutProps {
  pageTitle: string;
  children: React.ReactNode | React.ReactNode[];
}

const AuthenticatedPageLayout: React.FC<AuthenticatedPageLayoutProps> = ({ pageTitle, children }) => {
  return (
    <AuthenticatedPage>
      <Titlebar pageTitle={pageTitle} />
      <div className="flex w-full flex-auto flex-row">
        <div id="content" className="flex h-full w-full flex-none flex-col">
          {children}
        </div>
      </div>
    </AuthenticatedPage>
  );
};

export default AuthenticatedPageLayout;
