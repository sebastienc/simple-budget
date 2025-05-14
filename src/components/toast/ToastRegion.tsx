import React from 'react';
import { UNSTABLE_ToastRegion as ReactAriaToastRegion } from 'react-aria-components';
import { useToaster } from '@/toast/useToaster';
import Toast from '@/components/toast/Toast';

const ToastRegion: React.FC = () => {
  const { queue } = useToaster();

  return (
    <ReactAriaToastRegion
      className="fixed right-4 bottom-4 flex flex-col-reverse gap-2 rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600"
      queue={queue}
    >
      {({ toast }) => <Toast toast={toast} />}
    </ReactAriaToastRegion>
  );
};

export default ToastRegion;
