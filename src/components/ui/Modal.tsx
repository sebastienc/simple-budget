import React from 'react';
import { Dialog, Heading, Modal as AriaModal, ModalOverlay } from 'react-aria-components';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Button from './Button';

export interface ModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  /** Quiet text under the title explaining what the panel is for. */
  description?: React.ReactNode;
  closeLabel: string;
  children: React.ReactNode;
}

/**
 * A centred dialog on a dimmed ground.
 *
 * Sized to the content up to a cap, and scrolling inside itself rather than
 * growing past the viewport — a snapshot list has no fixed length.
 */
const Modal: React.FC<ModalProps> = ({ isOpen, onOpenChange, title, description, closeLabel, children }) => (
  <ModalOverlay
    isOpen={isOpen}
    onOpenChange={onOpenChange}
    isDismissable
    className="fixed inset-0 z-20 flex min-h-full items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-[2px] entering:animate-in entering:fade-in exiting:animate-out exiting:fade-out"
  >
    <AriaModal className="w-full max-w-xl outline-hidden entering:animate-in entering:zoom-in-95 exiting:animate-out exiting:zoom-out-95">
      <Dialog className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto rounded-xl border border-rule bg-surface-raised p-6 shadow-xl outline-hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Heading slot="title" className="font-display text-lg font-semibold text-ink">
              {title}
            </Heading>
            {description && <p className="text-xs text-ink-3">{description}</p>}
          </div>
          <Button variant="ghost" size="sm" aria-label={closeLabel} onPress={() => onOpenChange(false)} className="flex-none border-none px-1.5 py-1.5">
            <XMarkIcon className="h-4 w-4" />
          </Button>
        </div>
        {children}
      </Dialog>
    </AriaModal>
  </ModalOverlay>
);

export default Modal;
