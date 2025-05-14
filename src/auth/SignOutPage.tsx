import React, { useEffect } from 'react';
import Loading from '../components/Loading';
import { basicRoutes } from '../routes';
import { useFirebaseAuth } from '../firebase/useFirebaseAuth';
import { useNavigate } from 'react-router-dom';

const SignoutPage: React.FC = () => {
  const { isLoading, isLoggedIn, signOut } = useFirebaseAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const doSignOut = async () => {
      if (!isLoading && isLoggedIn) {
        await signOut();
        navigate(basicRoutes.start);
      }
    }
    doSignOut();
  }, [isLoading, isLoggedIn]);

  return (
    <Loading />
  );
}

export default SignoutPage;
