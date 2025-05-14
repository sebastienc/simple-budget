import React, { useEffect} from 'react';
import { basicRoutes } from '../routes';
import { useNavigate } from 'react-router-dom';
import { useFirebaseAuth } from '../firebase/useFirebaseAuth';
import { useRedirectToLastKnownUrl } from './hooks/useRedirectToLastKnownUrl';
import IsVisibleWhen from './conditions/IsVisibleWhen';

export interface AuthenticatedPageProps {
  children: React.ReactNode | React.ReactNode[];
}

const AuthenticatedPage: React.FC<AuthenticatedPageProps> = ({ children }) => {
  const { isLoggedIn } = useFirebaseAuth();
  const { setLastKnownUrl, getLastKnownUrl } = useRedirectToLastKnownUrl();
  const navigate = useNavigate();
  const requestedPath = location.pathname;
  const maybeLastKnownUrl = getLastKnownUrl();

  if (requestedPath !== maybeLastKnownUrl) {
    console.log(`requestedPath: %s`, requestedPath);
    console.log(`last known url: %s`, maybeLastKnownUrl);
    setLastKnownUrl(requestedPath);
  }
  
  useEffect(() => {
    if (!isLoggedIn) {
      navigate(basicRoutes.signIn);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  return (
    <IsVisibleWhen condition={isLoggedIn}>
      <div className='flex flex-col w-full h-full'>
        {children}
      </div>
    </IsVisibleWhen>
  )
};

export default AuthenticatedPage
