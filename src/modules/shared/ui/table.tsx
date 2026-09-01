import * as React from 'react';
import { cn } from '@/modules/shared/lib/utils';

// shadcn/ui `new-york` Table family, owned by the repo. Every admin list wraps this in its own
// `overflow-x-auto` container (see `Table`'s built-in wrapper below) so wide tables scroll inside
// their own box on small viewports instead of breaking the page layout — the responsive strategy
// this project uses for dense tabular admin data.

export function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-x-auto scrollbar-hidden rounded-lg border border-border">
      <table data-slot="table" className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead data-slot="table-header" className={cn('bg-muted/50', className)} {...props} />;
}

export function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('divide-y divide-border [&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn('transition-colors hover:bg-muted/40', className)}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      scope="col"
      className={cn(
        // Sentence case, not all-caps. Uppercase letter-spaced heads were the same treatment the
        // site used for section headings, which flattened the difference between "this names a
        // column" and "this names a section" — and all-caps is measurably slower to read.
        'h-11 whitespace-nowrap px-4 text-left align-middle text-xs font-semibold text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn('px-4 py-3.5 align-middle', className)}
      {...props}
    />
  );
}

export function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('mt-4 text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}
