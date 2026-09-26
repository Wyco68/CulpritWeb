'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/modules/shared/lib/utils';
import { Tooltip } from './tooltip';
import { useNativeDialog } from './dialog';

// A side sheet on the same native <dialog> as `Dialog` — focus trap, top layer, Escape and the
// backdrop all come from the platform (see dialog.tsx). Only the placement differs: pinned to the
// right edge at full dynamic-viewport height, so it clears mobile Safari's collapsing toolbar.
//
// Used for the mobile navigation on both sides of the app. `overscroll-contain` keeps a flick past
// the end of the list from scrolling the page underneath.

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  closeLabel?: string;
}

export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  className,
  closeLabel = 'Close menu',
}: SheetProps) {
  const { ref, dialogProps } = useNativeDialog(open, onOpenChange);
  const titleId = React.useId();

  return (
    <dialog
      {...dialogProps}
      aria-labelledby={titleId}
      className={cn(
        'sheet-enter fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-[min(22rem,88vw)] max-w-none',
        'overflow-y-auto overscroll-contain border-l border-border-strong bg-surface p-0 text-foreground shadow-raised',
        'backdrop:bg-foreground/40',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <h2 id={titleId} className="font-serif text-lg text-foreground">
          {title}
        </h2>
        <Tooltip content={closeLabel} side="left">
          <button
            type="button"
            aria-label={closeLabel}
            onClick={() => ref.current?.close()}
            className="focus-ring -mr-2 shrink-0 rounded-md p-2.5 text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
      <div className="px-5 py-5">{children}</div>
    </dialog>
  );
}
