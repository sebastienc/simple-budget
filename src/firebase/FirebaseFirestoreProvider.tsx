import React, { useEffect, useMemo, useState } from 'react';
import { useFirebase } from './useFirebase';
import { FirebaseFirestoreContext} from './useFirebaseFirestore';
import type { FirebaseFirestoreContextProps} from './useFirebaseFirestore';
import { Firestore, initializeFirestore } from "firebase/firestore";
// import { useCollectionData } from 'react-firebase-hooks/firestore';

export interface FirebaseFirestoreProviderProps {
  children: React.ReactNode | React.ReactNode[];
}

const FirebaseFirestoreProvider: React.FC<FirebaseFirestoreProviderProps> = ({ children }) => {
  const { app, isLoading: appIsLoading } = useFirebase();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [db, setDB] = useState<Firestore>();
  
  useEffect(() => {

    if (app && !db) {
      setIsLoading(true); 
      const firebaseDb = initializeFirestore(app, {
        ignoreUndefinedProperties: true,
      });
      setDB(firebaseDb);
      setIsLoading(false);
      return;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appIsLoading, app]);

  const wrapper: FirebaseFirestoreContextProps = useMemo(
    () => ({
      isLoading,
      db,
    }),
    [db, isLoading],
  );
  return (
    <FirebaseFirestoreContext.Provider value={wrapper}>
      <>{children}</>
    </FirebaseFirestoreContext.Provider>
  );
};

export default FirebaseFirestoreProvider;
