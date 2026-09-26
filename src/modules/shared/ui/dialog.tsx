'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/modules/shared/lib/utils';
import { Tooltip } from './tooltip';

// Accessible modal built on the native <dialog> element instead of a Radix Dialog dependency
// (none is installed in this project). `showModal()` gives us, for free, per the HTML spec: a
// focus trap, top-layer stacking + ::backdrop, Escape-to-close (fires the native `cancel`/`close`
// events, which we sync back into React state), and an implicit `role="dialog"` — everything
// WCAG 2.1 AA requires of a modal without hand-rolling focus-trap logic.
export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  closeLabel?: string;
}

/**
 * Syncs a native <dialog> with React's `open` state. Shared by `Dialog` and `Sheet`, which differ
 * only in placement: the returned props give both backdrop-click and Escape handling, and the
 * element's own `close` event stays the single source of truth for "closed".
 */
export function useNativeDialog(open: boolean, onOpenChange: (open: boolean) => void) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // Fires on Escape and on programmatic `.close()` — the single source of truth for "closed".
    const handleClose = () => onOpenChange(false);
    node.addEventListener('close', handleClose);
    return () => node.removeEventListener('close', handleClose);
  }, [onOpenChange]);

  const dialogProps = {
    ref,
    onClick: (event: React.MouseEvent<HTMLDialogElement>) => {
      // Native dialog backdrop clicks land on the <dialog> element itself, not a child.
      if (event.target === ref.current) onOpenChange(false);
    },
    onCancel: (event: React.SyntheticEvent<HTMLDialogElement>) => {
      // Let the `close` listener above own state sync; just avoid duplicate default handling.
      event.preventDefault();
      ref.current?.close();
    },
  };

  return { ref, dialogProps };
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  closeLabel = 'Close',
}: DialogProps) {
  const { ref, dialogProps } = useNativeDialog(open, onOpenChange);
  const titleId = React.useId();
  const descriptionId = React.useId();

  return (
    <dialog
      {...dialogProps}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={cn(
        'w-full max-w-xl rounded-lg border border-border bg-background p-0 text-foreground shadow-raised backdrop:bg-foreground/40 backdrop:backdrop-blur-[1px]',
        // `overscroll-contain`: the dialog is capped at 85vh and scrolls internally, so without
        // it a flick past the end of a long form keeps going and scrolls the page underneath —
        // the modal stays put while its backdrop content slides, which reads as a broken overlay
        // and loses the place the user had on the page behind it.
        'm-auto max-h-[85dvh] overflow-y-auto overscroll-contain',
        className,
      )}
    >
      {/* The header stays put while a long form scrolls beneath it, so the task you are in the
          middle of is always named on screen. */}
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-background px-6 py-5">
        <div>
          <h2 id={titleId} className="font-serif text-xl text-foreground">
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        <Tooltip content={closeLabel} side="left">
          <button
            type="button"
            aria-label={closeLabel}
            onClick={() => ref.current?.close()}
            className="focus-ring -mr-1.5 -mt-1 shrink-0 rounded-md p-2.5 text-muted-foreground transition-colors duration-200 ease-[var(--ease-out-expo)] hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
      <div className="px-6 py-6">{children}</div>
    </dialog>
  );
}

// The action row for a form inside a Dialog. Sticks to the bottom of the dialog's scroll area, so
// Cancel/Save stay reachable on a long form instead of sitting below the fold — previously you had
// to scroll a form you had already filled in just to find the button that submits it.
//
// Negative margins pull it out of the body's `px-6 py-6` padding so its rule spans the full width
// of the dialog, matching the header's.
export function DialogFooter({ children, className }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 -mx-6 -mb-6 mt-2 flex items-center justify-end gap-3 border-t border-border bg-background px-6 py-4',
        className,
      )}
    >
      {children}
    </div>
  );
}
