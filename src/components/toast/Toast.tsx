import React from 'react';
import { Button, Text, UNSTABLE_Toast as ReactAriaToast, UNSTABLE_ToastContent as ToastContent, type QueuedToast } from 'react-aria-components';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { type MyToastContent } from '@/toast/types';

export interface ToastProps {
  toast: QueuedToast<MyToastContent>;
}

const Toast: React.FC<ToastProps> = ({ toast }) => (
  <ReactAriaToast
    toast={toast}
    className="flex items-center gap-3 rounded-lg border border-rule bg-surface-raised px-4 py-3 shadow-lg outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
  >
    <ToastContent className="flex min-w-0 flex-auto flex-col">
      <Text slot="title" className="text-sm font-medium text-ink">
        {toast.content.title}
      </Text>
      {toast.content.description && (
        <Text slot="description" className="text-xs text-ink-2">
          {toast.content.description}
        </Text>
      )}
    </ToastContent>
    <Button
      slot="close"
      aria-label="Close"
      className="flex h-6 w-6 flex-none cursor-default appearance-none items-center justify-center rounded-full bg-transparent p-0 text-ink-3 outline-hidden transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
    >
      <XMarkIcon className="h-4 w-4" />
    </Button>
  </ReactAriaToast>
);

export default Toast;
