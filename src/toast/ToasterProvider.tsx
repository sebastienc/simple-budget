import React, { useEffect, useMemo, useState } from 'react';
import { UNSTABLE_ToastQueue as ToastQueue } from 'react-aria-components';
import { ToasterContext, type ToasterContextProps } from './useToaster';
import { type MyToastContent } from './types';

export interface ToasterProviderProps {
  children?: React.ReactNode | React.ReactNode[];
}

const ToasterProvider: React.FC<ToasterProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [queue, setQueue] = useState<ToastQueue<MyToastContent>>(new ToastQueue<MyToastContent>());

  useEffect(() => {
    if (!queue) {
      setIsLoading(true);
      setQueue(new ToastQueue<MyToastContent>());
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addToast = (title: string, description?: string): void => {
    if (!queue) {
      return;
    }
    queue.add(
      {
        title: title,
        description: description,
      },
      { timeout: 5000 },
    );
  };

  const wrapper: ToasterContextProps = useMemo(
    () => ({
      queue,
      isLoading,
      addToast,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isLoading, queue],
  );

  return <ToasterContext.Provider value={wrapper}>{children}</ToasterContext.Provider>;
};

export default ToasterProvider;
