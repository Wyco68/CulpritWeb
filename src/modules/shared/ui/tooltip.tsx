'use client';

import type { FocusEvent, ReactElement, ReactNode } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/modules/shared/lib/utils';
import { Button, type ButtonProps } from './button';

// Radix Tooltip, owned by the repo. Shown on hover and on keyboard focus, dismissed by Escape;
// Radix wires `aria-describedby` from the trigger to the bubble.
//
// Rendered in place, never portalled to <body>. Most icon buttons live inside the native <dialog>
// modals, which sit in the browser's top layer — a bubble portalled to <body> would render beneath
// the very dialog it belongs to. Radix positions the content with `position: fixed`, so an
// `overflow` ancestor (a scrolling table, a dialog body) does not clip it either.
//
// A tooltip only ever repeats what the control is. It never carries information of its own, so a
// touch user who cannot hover loses nothing — the control's accessible name says the same thing.

/**
 * Opening a dialog focuses its close button, and closing a menu hands focus back to its trigger —
 * both programmatic, and a bubble popping up for either reads as noise. Only focus the browser
 * marks `:focus-visible` (keyboard navigation) opens the tooltip; hover is unaffected. Preventing
 * default is how Radix's composed handler is told to stand down.
 */
function skipUnlessFocusVisible(event: FocusEvent<HTMLElement>) {
  try {
    if (!event.currentTarget.matches(':focus-visible')) event.preventDefault();
  } catch {
    // An engine without `:focus-visible` support: keep Radix's default behaviour.
  }
}

export function Tooltip({
  content,
  side = 'top',
  children,
}: {
  content: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** The trigger: one element that accepts a ref and forwards props (every shared control does). */
  children: ReactElement;
}) {
  // Each tooltip carries its own provider, so a control renders correctly wherever it is mounted —
  // including isolated component tests, which render without the app's provider tree.
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild onFocus={skipUnlessFocusVisible}>
          {children}
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            'z-50 max-w-64 rounded-sm bg-foreground px-2.5 py-1.5 text-xs font-medium text-surface shadow-raised',
            'data-[state=delayed-open]:animate-[tooltip-in_var(--duration-fast)_var(--ease-out-expo)]',
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-foreground" width={10} height={5} />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

export interface IconButtonProps extends Omit<ButtonProps, 'size' | 'aria-label'> {
  /** The accessible name — required, since the button has no visible text. */
  label: string;
  /** The bubble's text, when shorter than the accessible name ("Actions" for "Actions: Jane"). */
  tooltip?: string;
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
}

/**
 * A button whose only content is an icon. Always named (`label`) and always explained on hover and
 * focus, so no icon-only control can ship without either.
 */
export function IconButton({
  label,
  tooltip,
  tooltipSide,
  variant = 'ghost',
  ...props
}: IconButtonProps) {
  return (
    <Tooltip content={tooltip ?? label} side={tooltipSide}>
      <Button variant={variant} size="icon" aria-label={label} {...props} />
    </Tooltip>
  );
}
