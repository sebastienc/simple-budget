import React from 'react';
import type { User } from 'firebase/auth';

export interface FirebaseAuthContextProps {
  user?: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const FirebaseAuthContext = React.createContext<FirebaseAuthContextProps>(undefined!);
export const useFirebaseAuth = () => React.useContext(FirebaseAuthContext);
