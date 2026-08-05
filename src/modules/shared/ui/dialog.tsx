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
        'w-full max-w-lg rounded-lg border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-foreground/40 backdrop:backdrop-blur-[1px]',
        'm-auto max-h-[85vh] overflow-y-auto',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border p-5">
        <div>
          <h2 id={titleId} className="text-base font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label={closeLabel}
          onClick={() => ref.current?.close()}
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}
