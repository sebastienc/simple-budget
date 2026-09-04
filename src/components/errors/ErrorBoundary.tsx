import React from 'react';
import { useRouteError } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageLayout from '@/components/layouts/PageLayout';

export interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

/** Routing errors arrive as anything at all, so coerce to something renderable. */
function describe(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return null;
}

export const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({ children }) => {
  const { t } = useTranslation();
  const error = useRouteError();

  if (!error) {
    return <>{children}</>;
  }

  const detail = describe(error);

  return (
    <PageLayout>
      <div className="flex flex-col items-start gap-4 py-12">
        <h1 className="font-display text-3xl font-semibold text-ink">{t('SomethingWentWrong')}</h1>
        {/* Previously this rendered the raw error, which throws for a non-string. */}
        {detail && <p className="max-w-[60ch] font-mono text-sm text-ink-2">{detail}</p>}
      </div>
    </PageLayout>
  );
};

export default ErrorBoundary;
