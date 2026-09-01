import * as React from 'react';
import { cn } from '@/modules/shared/lib/utils';

// The single heading treatment for every page on both sides of the app. Previously each of the
// six public tabs and each of the six admin screens hand-rolled its own heading string
// (`text-xl font-semibold tracking-tight sm:text-2xl` on one side, `text-2xl font-semibold
// tracking-tight` on the other), so the two halves of the product drifted apart and neither was
// consistent within itself.
//
// Set in the text serif: this is the document's voice, not interface chrome. No rule or accent
// mark above it — the type size already says "a new page starts here", and a decorative dash on
// every screen just added another horizontal line to a layout already structured by them.

export interface PageHeadingProps {
  title: string;
  /** Optional standfirst. Sets the reader's expectation before the content proper. */
  intro?: string;
  /**
   * Heading level. Public tabs render `h2` (the masthead's name is the page's `h1`); admin
   * screens have no masthead heading above them, so they render `h1`.
   */
  as?: 'h1' | 'h2';
  /** Right-aligned action for admin screens — typically the "Add" button. */
  action?: React.ReactNode;
  className?: string;
}

export function PageHeading({ title, intro, as: Tag = 'h2', action, className }: PageHeadingProps) {
  return (
    <header className={cn('rise flex items-start justify-between gap-6', className)}>
      <div className="min-w-0">
        <Tag className="text-balance font-serif text-3xl font-normal leading-[1.15] tracking-[-0.015em] sm:text-4xl">
          {title}
        </Tag>
        {intro && (
          // ~62 characters. Past roughly 65 the eye loses the line it is returning to.
          <p className="mt-4 max-w-[62ch] text-pretty text-base leading-[1.7] text-muted-foreground">
            {intro}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
