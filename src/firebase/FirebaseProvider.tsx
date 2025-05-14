import React, { useEffect, useMemo, useState } from 'react';
import { FirebaseContext } from './useFirebase';
import type { FirebaseContextProps } from "./useFirebase";
import { initializeApp } from "firebase/app";
import type { FirebaseOptions, FirebaseApp } from "firebase/app";

export interface FirebaseProviderProps {
  children: React.ReactNode | React.ReactNode[];
}

const FirebaseProvider: React.FC<FirebaseProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [app, setApp] = useState<FirebaseApp>();

  // TODO: Replace the following with your app's Firebase project configuration
  // See: https://firebase.google.com/docs/web/learn-more#config-object
  const firebaseConfig: FirebaseOptions = {
      apiKey: "AIzaSyDLCL_ZS9NoYrjcNmhJN9ysMrDAzppJFm4",
      authDomain: "simple-budget-e3c6f.firebaseapp.com",
      projectId: "simple-budget-e3c6f",
      storageBucket: "simple-budget-e3c6f.firebasestorage.app",
      messagingSenderId: "32271872631",
      appId: "1:32271872631:web:8b3cb524ea3b355944cc72",
      measurementId: "G-66JV5NKLKS"
  };
  
  useEffect(() => {
    if (!app) {
      setApp(initializeApp(firebaseConfig));
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const wrapper: FirebaseContextProps = useMemo(
    () => ({
      app,
      isLoading,
    }),
    [app, isLoading],
  );
  return (
    <FirebaseContext.Provider value={wrapper}>
      <>{children}</>
    </FirebaseContext.Provider>
  );
};

export default FirebaseProvider;
