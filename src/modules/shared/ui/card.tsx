import * as React from 'react';
import { cn } from '@/modules/shared/lib/utils';

// shadcn/ui `new-york` Card family, owned by the repo (copied, not a black-box dependency).
// data-slot attributes are the styling hook per the component system convention.
//
// A card is a flat panel: its own white fill against the tinted page ground, a defined edge, and a
// hairline shadow — no more. It does not float. Anything that genuinely sits above the page
// (dialogs, menus) opts into `shadow-raised` explicitly, so elevation still means something when
// it is used.

/**
 * The panel treatment, as a bare class string for the public lists.
 *
 * Those lists render a `<section>` that is already carrying grid and animation classes, so wrapping
 * each one in a `<Card>` would add a redundant element around it. Sharing the string instead keeps
 * a publication year, a research area, a course level and a CV section visually identical without
 * forcing them all through the same component.
 */
export const panelClassName =
  'rounded-lg border border-border-strong bg-surface p-6 shadow-hairline sm:p-8';

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'rounded-lg border border-border-strong bg-surface text-foreground shadow-hairline',
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="card-header" className={cn('flex flex-col gap-2 p-6', className)} {...props} />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return (
    <h3
      data-slot="card-title"
      className={cn('text-balance font-serif text-lg leading-tight text-foreground', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-description"
      className={cn('text-pretty text-sm leading-relaxed text-muted-foreground', className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('p-6 pt-0', className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex items-center gap-3 p-6 pt-0', className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
