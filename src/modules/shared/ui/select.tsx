import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/modules/shared/lib/utils';

// Native <select>, styled to match the shadcn/ui `new-york` Input family. No Radix Select
// dependency is installed; a native control is fully keyboard/screen-reader operable out of the
// box (arrow keys, type-ahead) and needs no focus-trap plumbing — the pragmatic choice for the
// two pickers this app needs (status filter, research-group assignment).
export const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        data-slot="select"
        className={cn(
          'flex h-9 w-full appearance-none rounded-md border border-border bg-background px-3 py-1 pr-8 text-sm text-foreground shadow-sm outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          'focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring/40',
          'aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/30',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  ),
);
Select.displayName = 'Select';
