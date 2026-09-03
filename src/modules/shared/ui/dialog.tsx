'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/modules/shared/lib/utils';

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

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  closeLabel = 'Close',
}: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

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

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={(event) => {
        // Native dialog backdrop clicks land on the <dialog> element itself, not a child.
        if (event.target === ref.current) onOpenChange(false);
      }}
      onCancel={(event) => {
        // Let the `close` listener above own state sync; just avoid duplicate default handling.
        event.preventDefault();
        ref.current?.close();
      }}
      className={cn(
        'w-full max-w-xl rounded-lg border border-border bg-background p-0 text-foreground shadow-raised backdrop:bg-foreground/40 backdrop:backdrop-blur-[1px]',
        // `overscroll-contain`: the dialog is capped at 85vh and scrolls internally, so without
        // it a flick past the end of a long form keeps going and scrolls the page underneath —
        // the modal stays put while its backdrop content slides, which reads as a broken overlay
        // and loses the place the user had on the page behind it.
        'm-auto max-h-[85vh] overflow-y-auto overscroll-contain',
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
        <button
          type="button"
          aria-label={closeLabel}
          onClick={() => ref.current?.close()}
          className="-mr-1.5 -mt-1 shrink-0 rounded-md p-2 text-muted-foreground transition-colors duration-200 ease-[var(--ease-out-expo)] hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
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
