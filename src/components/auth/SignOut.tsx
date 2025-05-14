import React from 'react';
import Button from '../buttons/Button';
import { ArrowLeftEndOnRectangleIcon } from '@heroicons/react/24/outline';
import { basicRoutes } from '../../routes';
import { useNavigate } from 'react-router-dom';
import { useFirebaseAuth } from '../../firebase/useFirebaseAuth';
import { useTranslation } from 'react-i18next';

const SignOut: React.FC = () => {
  const navigate = useNavigate();
  const { signOut } = useFirebaseAuth();
  const { t } = useTranslation();

  const doSignOut = async () => {
      await signOut();
      navigate(basicRoutes.start);
  }

  return (
    <Button aria-label="Sign Out" onClick={doSignOut} className="flex items-center">
      <ArrowLeftEndOnRectangleIcon className='w-4 h-4 m-2' />
      <span className='text-sm'>{t('Sign Out')}</span>
    </Button>
  )
};

export default SignOut
