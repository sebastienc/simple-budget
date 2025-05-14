import React from 'react';
import { Button, Text, UNSTABLE_Toast as ReactAriaToast, UNSTABLE_ToastContent as ToastContent, type QueuedToast } from 'react-aria-components';
import { type MyToastContent } from '@/toast/types';

export interface ToastProps {
  toast: QueuedToast<MyToastContent>;
}

const Toast: React.FC<ToastProps> = ({ toast }) => {
  return (
    <ReactAriaToast
      toast={toast}
      className="flex items-center gap-4 rounded-lg bg-slate-600 px-4 py-3 text-white outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600"
    >
      <ToastContent className="flex min-w-0 flex-auto flex-col">
        <Text slot="title" className="font-bold">
          {toast.content.title}
        </Text>
        <Text slot="description">{toast.content.description}</Text>
      </ToastContent>
      <Button
        slot="close"
        className="flex h-8 w-8 flex-none appearance-none items-center justify-center rounded-full border border-white bg-transparent p-0 text-base text-white outline-none focus-visible:ring-2 focus-visible:ring-slate-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white pressed:bg-white/20"
      >
        x
      </Button>
    </ReactAriaToast>
  );
};

export default Toast;
