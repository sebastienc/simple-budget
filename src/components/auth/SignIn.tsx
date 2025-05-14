import React from 'react';
import { useFirebaseAuth } from '../../firebase/useFirebaseAuth';
import GoogleLogo from '../icons/GoogleLogo';
import Button from '../buttons/Button';
import { useTranslation } from 'react-i18next';

const SignIn: React.FC = () => {
  const { signInWithGoogle } = useFirebaseAuth();
  const { t } = useTranslation();

  return (
    <div className='flex flex-col h-full border-l-4 px-4'>
      <Button aria-label="Sign in with Google" onClick={signInWithGoogle} className="flex items-center bg-white border border-button-border-light rounded-md p-0.5 pr-3">
        <GoogleLogo />
        <span className='text-sm text-black tracking-wider'>{t('Sign in with Google')}</span>
      </Button>
    </div>
  )
};

export default SignIn
