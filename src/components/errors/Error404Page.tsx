import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageLayout from '@/components/layouts/PageLayout';
import Button from '@/components/ui/Button';
import { basicRoutes } from '@/lib/routes';

const Error404Page: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <PageLayout>
      <div className="flex flex-col items-start gap-4 py-12">
        <p className="font-mono text-sm text-ink-3">404</p>
        <h1 className="font-display text-3xl font-semibold text-ink">{t('PageNotFound')}</h1>
        <Button onPress={() => navigate(basicRoutes.home)}>{t('BackToHome')}</Button>
      </div>
    </PageLayout>
  );
};

export default Error404Page;
