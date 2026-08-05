import * as React from 'react';
import { cn } from '@/modules/shared/lib/utils';

// shadcn/ui `new-york` Label, owned by the repo. Plain <label>, no Radix dependency needed — the
// association to its control is via `htmlFor`/`id`, wired by the shared `FormField`.
export const Label = React.forwardRef<HTMLLabelElement, React.ComponentProps<'label'>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      data-slot="label"
      className={cn(
        'text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      {...props}
    />
  ),
);
Label.displayName = 'Label';
