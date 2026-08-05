import * as React from 'react';
import { cn } from '@/modules/shared/lib/utils';

// shadcn/ui `new-york` Input, owned by the repo. Validation state is conveyed by the caller via
// `aria-invalid` (the shared `FormField` wires this up) — the ring color below reacts to it so
// invalid fields are never distinguished by a border color change alone (paired with the field's
// text error message).

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      data-slot="input"
      className={cn(
        'flex h-9 w-full min-w-0 rounded-md border border-border bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring/40',
        'aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/30',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
