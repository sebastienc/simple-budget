import React from 'react';
import { DialogTrigger, Button, Modal, Dialog, Heading } from 'react-aria-components';

interface DrawerProps {
  triggerText: string;
  title: string;
  children: React.ReactNode;
}

const Drawer: React.FC<DrawerProps> = ({ triggerText, title, children }) => {
  return (
    <DialogTrigger>
      {/* Use the provided trigger element directly */}
      <Button className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950">
        {triggerText}
      </Button>
      <Modal
        isDismissable // Allows closing by pressing Escape or clicking outside
        className="fixed inset-0 z-40 flex justify-start bg-black/50 backdrop-blur-sm data-[entering]:animate-in data-[entering]:fade-in data-[exiting]:animate-out data-[exiting]:fade-out"
      >
        {/* RACDialog is the actual drawer panel content and styling */}
        <Dialog
          className="z-50 flex h-dvh w-full max-w-sm flex-col border-l border-gray-200 bg-white shadow-xl transition-transform duration-300 ease-in-out outline-none data-[entering]:translate-x-0 data-[exiting]:translate-x-full dark:border-zinc-700 dark:bg-zinc-900"
          // Note: If using the react-aria-components Tailwind plugin,
          // you could use variants like:
          // entering:slide-in-from-right exiting:slide-out-to-right
        >
          {(
            { close }, // Dialog provides the close function via its render prop
          ) => (
            <>
              <header className="flex flex-shrink-0 items-center justify-between border-b border-gray-200 p-4 dark:border-zinc-700">
                <Heading slot="title" className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {title}
                </Heading>
                <Button onPress={close} className="rounded p-1 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-zinc-700" aria-label="Close drawer">
                  {/* Simple X icon; consider using a library like lucide-react if available */}
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6 text-gray-700 dark:text-gray-300">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              </header>
              <div className="flex-1 overflow-y-auto p-4">{children}</div>
            </>
          )}
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
};

export default Drawer;
