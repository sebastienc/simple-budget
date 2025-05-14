import React, { useEffect, useMemo, useState } from 'react';
import { useFirebase } from './useFirebase';
import { FirebaseAuthContext } from './useFirebaseAuth';
import type { FirebaseAuthContextProps } from './useFirebaseAuth';
import { useRedirectToLastKnownUrl } from '../components/hooks/useRedirectToLastKnownUrl';

import { getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut  } from "firebase/auth";
import type { Auth, User } from "firebase/auth";

export interface FirebaseAuthProviderProps {
  children: React.ReactNode | React.ReactNode[];
}

const FirebaseAuthProvider: React.FC<FirebaseAuthProviderProps> = ({ children }) => {
  const { app, isLoading: appIsLoading } = useFirebase();
  const { clearLastKnownUrl } = useRedirectToLastKnownUrl();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [auth, setAuth] = useState<Auth>();
  const [user, setUser] = useState<User>();

  
  useEffect(() => {

    if (app && !auth) {
      setIsLoading(true);
      const firebaseAuth = getAuth(app)
      setAuth(firebaseAuth);
      const unregisterAuthObserver = onAuthStateChanged(
        firebaseAuth,
        (user) => {
          if (user) {
            setUser(user);
            setIsLoggedIn(true);
          }
        });
        setIsLoading(false);
        return unregisterAuthObserver;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appIsLoading, app]);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    if (auth) {
      try {
        const result = await setPersistence(auth, browserLocalPersistence).then(() => {
          return signInWithPopup(auth, provider);
        })
        setUser(result.user);
        setIsLoggedIn(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        console.log(`There was an error logging in: ${err}`);
      }
    }
    return;
  }

  const signOut = async () => {
    if (auth) {
      await firebaseSignOut(auth);
      clearLastKnownUrl();
      setIsLoggedIn(false);
      setUser(undefined);
    }
    return;
  }

  const wrapper: FirebaseAuthContextProps = useMemo(
    () => ({
      isLoggedIn,
      isLoading,
      user,
      signInWithGoogle,
      signOut,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [auth, isLoggedIn, isLoading, user],
  );
  return (
    <FirebaseAuthContext.Provider value={wrapper}>
      <>{children}</>
    </FirebaseAuthContext.Provider>
  );
};

export default FirebaseAuthProvider;
