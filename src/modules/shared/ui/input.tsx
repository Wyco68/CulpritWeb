import * as React from 'react';
import { cn } from '@/modules/shared/lib/utils';

// shadcn/ui `new-york` Input, owned by the repo.
//
// A field is drawn as a shallow well — tinted fill, a border that actually meets WCAG 1.4.11's
// 3:1 against both the page and its own fill — and lifts to a white fill with an accent border on
// focus. The previous white-on-white treatment measured 1.24:1 against the page, which is why a
// form read as a stack of indistinguishable rectangles.
//
// Validation state is conveyed by the caller via `aria-invalid` (the shared `FormField` wires
// this up). Invalid fields change border *and* carry the field's text error message, so state is
// never signalled by colour alone.

/** Shared by Input, Textarea and Select so the three are visually the same control family. */
export const fieldClassName = cn(
  'w-full rounded-md border border-input-border bg-input text-sm text-foreground',
  'transition-[background-color,border-color,box-shadow] duration-200 ease-[var(--ease-out-expo)]',
  'placeholder:text-muted-foreground',
  'outline-none focus-visible:border-accent focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/30',
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-muted',
  'aria-invalid:border-destructive aria-invalid:focus-visible:border-destructive aria-invalid:focus-visible:ring-destructive/25',
);

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(
        fieldClassName,
        'flex h-10 min-w-0 px-3 py-2',
        // Numeric fields line up their digits and drop the spinner's cramped default width.
        type === 'number' && 'tabular',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
