import { lazy } from 'react';
import { type NavigateOptions, useHref, useNavigate, Routes, Route } from 'react-router-dom';
import { RouterProvider } from 'react-aria-components';
import App from './App';
import Home from './home/Home';
import SignInPage from './auth/SignInPage';
import SignOutPage from './auth/SignOutPage';
import ErrorBoundary from './components/errors/ErrorBoundary';

declare module 'react-aria-components' {
  interface RouterConfig {
    routerOptions: NavigateOptions;
  }
}

const Error404Page = lazy(() => import('./components/errors/Error404Page'));

// eslint-disable-next-line react-refresh/only-export-components
export const basicRoutes = {
  start: '/',
  signIn: '/signin',
  signOut: '/signout',
  home: '/home',
};

export interface RouterProviderWrapperProps {
  children?: React.ReactNode | React.ReactNode[];
}

const RouterProviderWrapper: React.FC<RouterProviderWrapperProps> = ({ children }) => {
  const navigate = useNavigate();

  return (
    <RouterProvider navigate={navigate} useHref={useHref}>
      <>{children}</>
      <Routes>
        <Route path={basicRoutes.start} element={<App />} errorElement={<ErrorBoundary />} />
        <Route path={basicRoutes.signIn} element={<SignInPage />} errorElement={<ErrorBoundary />} />
        <Route path={basicRoutes.signOut} element={<SignOutPage />} errorElement={<ErrorBoundary />} />
        <Route path={basicRoutes.home} element={<Home />} errorElement={<ErrorBoundary />} />
        <Route path="*" element={<Error404Page />} />
      </Routes>
    </RouterProvider>
  );
};

export default RouterProviderWrapper;
