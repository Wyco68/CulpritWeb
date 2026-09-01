import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/modules/shared/lib/utils';
import { fieldClassName } from './input';

// Native <select>, sharing `fieldClassName` with Input and Textarea. No Radix Select dependency is
// installed; a native control is fully keyboard/screen-reader operable out of the box (arrow keys,
// type-ahead) and needs no focus-trap plumbing — the pragmatic choice for the two pickers this app
// needs (status filter, research-group assignment).
//
// The chevron is the affordance that separates a select from a text input at a glance, so it sits
// in its own bordered compartment against the field's right edge rather than floating loose over
// the text — which is what made the two look identical before.
export const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        data-slot="select"
        className={cn(fieldClassName, 'peer flex h-10 appearance-none px-3 py-2 pr-11', className)}
        {...props}
      >
        {children}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-px right-px flex w-9 items-center justify-center rounded-r-md border-l border-input-border bg-muted text-muted-foreground peer-focus-visible:border-accent peer-disabled:opacity-60"
      >
        <ChevronDown className="size-4" />
      </span>
    </div>
  ),
);
Select.displayName = 'Select';
