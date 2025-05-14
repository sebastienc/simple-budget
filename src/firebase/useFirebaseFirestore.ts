import React from 'react';
import { Firestore } from 'firebase/firestore';

export interface FirebaseFirestoreContextProps {
  db?: Firestore | null;
  isLoading: boolean;
}

export const FirebaseFirestoreContext = React.createContext<FirebaseFirestoreContextProps>(undefined!);
export const useFirebaseFirestore = () => React.useContext(FirebaseFirestoreContext);
