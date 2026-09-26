'use client';

import * as React from 'react';
import { X, type LucideIcon } from 'lucide-react';
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
  /** `sm` for a confirmation, `md` (default) for a form, `lg` for wide content. */
  size?: 'sm' | 'md' | 'lg';
  /** Optional icon in a tile beside the title. */
  icon?: LucideIcon;
  /** `destructive` tints the icon tile — a confirmation for something that cannot be undone. */
  tone?: 'default' | 'destructive';
  /**
   * Asked before the user closes the dialog by Escape, the backdrop or the close button. Return
   * `false` to keep it open — a form uses this to confirm discarding unsaved input.
   */
  beforeClose?: () => boolean;
}

const SIZES: Record<NonNullable<DialogProps['size']>, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-4xl',
};

/**
 * Syncs a native <dialog> with React's `open` state. Shared by `Dialog` and `Sheet`, which differ
 * only in placement: the returned props give both backdrop-click and Escape handling, and the
 * element's own `close` event stays the single source of truth for "closed".
 */
export function useNativeDialog(
  open: boolean,
  onOpenChange: (open: boolean) => void,
  /** Consulted before a user-initiated close (Escape, backdrop, close button). `false` keeps it open. */
  beforeClose?: () => boolean,
) {
  const ref = React.useRef<HTMLDialogElement>(null);

  /** Close on the user's behalf, unless the guard says otherwise. */
  const requestClose = () => {
    if (beforeClose && !beforeClose()) return;
    ref.current?.close();
  };

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
      if (event.target === ref.current) requestClose();
    },
    onCancel: (event: React.SyntheticEvent<HTMLDialogElement>) => {
      // Let the `close` listener above own state sync; just avoid duplicate default handling.
      event.preventDefault();
      requestClose();
    },
  };

  return { ref, dialogProps, requestClose };
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  closeLabel = 'Close',
  size = 'md',
  icon: Icon,
  tone = 'default',
  beforeClose,
}: DialogProps) {
  const { dialogProps, requestClose } = useNativeDialog(open, onOpenChange, beforeClose);
  const titleId = React.useId();
  const descriptionId = React.useId();

  return (
    <dialog
      {...dialogProps}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={cn(
        // `open:flex`, never a bare `flex`: an author `display` would override the UA's
        // `dialog:not([open]) { display: none }` and leave a closed dialog on screen.
        'dialog-enter m-auto max-h-[88dvh] w-[calc(100%-2rem)] flex-col overflow-hidden rounded-xl border border-border-strong bg-surface p-0 text-foreground open:flex',
        'shadow-[0_1px_2px_hsl(150_20%_20%/0.06),0_24px_64px_-16px_hsl(150_30%_12%/0.35)]',
        'backdrop:bg-[hsl(150_30%_10%/0.45)] backdrop:backdrop-blur-sm',
        // On a phone the dialog rests on the bottom edge like a sheet: full width, reachable with
        // a thumb, and the page it came from still visible above it.
        'max-sm:mb-0 max-sm:mt-auto max-sm:max-h-[92dvh] max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0',
        SIZES[size],
        className,
      )}
    >
      {/* The header does not scroll with the body, so the task you are in the middle of is always
          named on screen. A wash of the masthead green ties every popup to the site's frame. */}
      <div className="flex shrink-0 items-start gap-4 border-b border-border bg-[color-mix(in_srgb,var(--masthead)_40%,var(--surface))] px-6 py-5">
        {Icon && (
          <span
            className={cn(
              'inline-flex size-10 shrink-0 items-center justify-center rounded-lg',
              tone === 'destructive'
                ? 'bg-destructive-tint text-destructive'
                : 'border border-border-strong bg-surface text-accent',
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 id={titleId} className="text-balance break-words font-serif text-xl text-foreground">
            {title}
          </h2>
          {description && (
            <p
              id={descriptionId}
              className="mt-1.5 text-pretty text-sm leading-relaxed text-muted-foreground"
            >
              {description}
            </p>
          )}
        </div>
        <Tooltip content={closeLabel} side="left">
          <button
            type="button"
            aria-label={closeLabel}
            onClick={requestClose}
            className="focus-ring -mr-2 -mt-1 shrink-0 rounded-md p-2.5 text-muted-foreground transition-colors duration-200 ease-[var(--ease-out-expo)] hover:bg-surface hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
      {/* The body is the scroll area. `overscroll-contain`: without it a flick past the end of a
          long form keeps going and scrolls the page underneath the modal. */}
      {/* No bottom padding when a footer is present: the sticky footer is the dialog's bottom edge,
          and padding beneath it would leave a strip of scrolled content showing below it (and make
          the body scroll by that much, so the footer covered the last field). */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6 has-[[data-dialog-footer]]:pb-0">
        {children}
      </div>
    </dialog>
  );
}

// The action row for a form inside a Dialog. Sticks to the bottom of the dialog's scroll area, so
// Cancel/Save stay reachable on a long form instead of sitting below the fold — previously you had
// to scroll a form you had already filled in just to find the button that submits it.
//
// Negative side margins pull it out of the body's `px-6` padding so its rule spans the full width
// of the dialog, matching the header's. It sticks to the bottom of the body (the scroll area), and
// the body drops its bottom padding when a footer is present — see Dialog.
export function DialogFooter({ children, className }: React.ComponentProps<'div'>) {
  return (
    <div
      data-dialog-footer
      className={cn(
        'sticky bottom-0 z-10 -mx-6 mt-4 flex items-center justify-end gap-3 border-t border-border bg-surface px-6 py-4',
        // Full-width, equal buttons on a phone: two thumb-sized targets instead of two small ones
        // crowded into a corner.
        'max-sm:[&>*]:flex-1',
        className,
      )}
    >
      {children}
    </div>
  );
}
