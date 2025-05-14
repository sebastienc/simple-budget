import React from 'react';
import type { FirebaseApp } from 'firebase/app';
import type { Analytics } from 'firebase/analytics';
import { Firestore } from 'firebase/firestore';

export interface FirebaseContextProps {
  app?: FirebaseApp;
  isLoading: boolean;
  analytics?: Analytics;
  firestore?: Firestore;
}

export const FirebaseContext = React.createContext<FirebaseContextProps>({ isLoading: true });
export const useFirebase = () => React.useContext(FirebaseContext);
