import React, { useEffect } from 'react';
import UnAuthenticatedPage from './components/UnAuthenticatedPage';
import Loading from './components/Loading';
import { basicRoutes } from './routes';
import { useNavigate } from 'react-router-dom';
import { useFirebaseAuth } from './firebase/useFirebaseAuth';
import { useRedirectToLastKnownUrl } from './components/hooks/useRedirectToLastKnownUrl';

const App: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn } = useFirebaseAuth();
  const { getLastKnownUrl } = useRedirectToLastKnownUrl();

  useEffect(() => {
    if (!isLoggedIn) {
      navigate(basicRoutes.signIn);
      return;
    } else {
      const maybeLastKnownUrl = getLastKnownUrl();
      if (maybeLastKnownUrl) {
        navigate(maybeLastKnownUrl);
        return;
      }
      navigate(basicRoutes.home);
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  return (
    <UnAuthenticatedPage>
      <Loading />
    </UnAuthenticatedPage>
  );
}

export default App;
