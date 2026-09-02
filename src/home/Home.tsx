import React from 'react';
import PageLayout from '../components/layouts/PageLayout';
import { useTranslation } from 'react-i18next';
import { Button } from 'react-aria-components';
import { useToaster } from '@/toast/useToaster';

const Home: React.FC = () => {
  const { t } = useTranslation();
  const { isLoading: isToasterLoading, addToast } = useToaster();

  return (
    <PageLayout pageTitle={t('Home')}>
      <div className="flex w-full flex-col items-center justify-center pt-4">
        <div className="flex w-full flex-row gap-8 p-4 pb-8">
          <div className="flex items-center justify-start text-xl font-semibold">{t('Hello')}</div>
          <Button
            onPress={
              isToasterLoading
                ? undefined
                : () => {
                    addToast('Bla', 'BlaBlabla');
                  }
            }
          >
            Bla
          </Button>
        </div>
        <div className="flex w-full flex-row gap-16 p-4"></div>
      </div>
    </PageLayout>
  );
};

export default Home;
