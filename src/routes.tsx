import { lazy } from 'react';
import { type NavigateOptions, useHref, useNavigate, Navigate, Routes, Route } from 'react-router-dom';
import { RouterProvider } from 'react-aria-components';
import Home from './home/Home';
import ErrorBoundary from './components/errors/ErrorBoundary';
import { basicRoutes } from '@/lib/routes';

declare module 'react-aria-components' {
  interface RouterConfig {
    routerOptions: NavigateOptions;
  }
}

const Error404Page = lazy(() => import('./components/errors/Error404Page'));

export interface RouterProviderWrapperProps {
  children?: React.ReactNode | React.ReactNode[];
}

const RouterProviderWrapper: React.FC<RouterProviderWrapperProps> = ({ children }) => {
  const navigate = useNavigate();

  return (
    <RouterProvider navigate={navigate} useHref={useHref}>
      <>{children}</>
      <Routes>
        <Route path={basicRoutes.start} element={<Navigate to={basicRoutes.home} replace />} errorElement={<ErrorBoundary />} />
        <Route path={basicRoutes.home} element={<Home />} errorElement={<ErrorBoundary />} />
        <Route path="*" element={<Error404Page />} />
      </Routes>
    </RouterProvider>
  );
};

export default RouterProviderWrapper;
