import type * as React from 'react';
import { cn } from '@/modules/shared/lib/utils';

// Two text roles that were hand-rolled as identical class strings across the public tabs: the
// serif intro paragraph under a page heading (five copies) and the heading of a section within a
// page (five copies). One definition each, so the whole site's reading voice is tuned here.

/** The serif standfirst: a tab's intro, the About overview, a member's biography. */
export function Standfirst({
  children,
  preserveLines = false,
  className,
}: {
  children: React.ReactNode;
  /** Keep the admin's own line breaks — for multi-paragraph prose typed into a textarea. */
  preserveLines?: boolean;
  className?: string;
}) {
  return (
    <p
      className={cn(
        // ~62 characters. Past roughly 65 the eye loses the line it is returning to.
        'max-w-[62ch] text-pretty break-words font-serif text-standfirst text-foreground',
        preserveLines && 'whitespace-pre-line',
        className,
      )}
    >
      {children}
    </p>
  );
}

/** A section heading inside a page. Public tabs use `h3` (the page heading is the `h2`). */
export function SectionHeading({
  as: Tag = 'h3',
  className,
  ...props
}: React.ComponentProps<'h3'> & { as?: 'h2' | 'h3' | 'h4' }) {
  return (
    <Tag
      className={cn('text-balance font-serif text-heading font-semibold text-accent', className)}
      {...props}
    />
  );
}
