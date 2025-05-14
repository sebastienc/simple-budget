import React from 'react';
import { type MyToastContent } from './types';
import { UNSTABLE_ToastQueue as ToastQueue } from 'react-aria-components';

export interface ToasterContextProps {
  queue: ToastQueue<MyToastContent>;
  isLoading: boolean;
  addToast: (title: string, description?: string) => void;
}

export const ToasterContext = React.createContext<ToasterContextProps>(undefined!);
export const useToaster = () => React.useContext(ToasterContext);
