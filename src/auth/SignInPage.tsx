import React, { useEffect } from 'react';
import UnAuthenticatedPage from '../components/UnAuthenticatedPage';
import SignIn from '../components/auth/SignIn';
import { basicRoutes } from '../routes';
import { useNavigate } from 'react-router-dom';
import { useFirebaseAuth } from '../firebase/useFirebaseAuth';

const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn } = useFirebaseAuth();

  useEffect(() => {
    console.log('IsLoggedIn: ', isLoggedIn);
    if (isLoggedIn) {
      navigate(basicRoutes.home);
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  return (
      <UnAuthenticatedPage>
        <div className='flex gap-4'>
          <span className='text-lg font-bold'>Simple Budget Login Page</span>
        </div>
        <div className='flex flex-row gap-4 p-4'>
          <div className='flex items-center justify-left'>Please use one of the following options to login</div>
          <SignIn />
        </div>
      </UnAuthenticatedPage>
  );
}

export default SignInPage;
