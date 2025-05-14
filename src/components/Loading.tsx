import React from 'react';
import { useTranslation } from 'react-i18next';

const Loading: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className='bg-background h-screen flex flex-col justify-center items-center'>
      {t('Loading')}
    </div>
  );
};

export default Loading;
