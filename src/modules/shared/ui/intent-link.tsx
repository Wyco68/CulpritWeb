'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentProps } from 'react';

// A `next/link` that prefetches on intent — pointer over it, keyboard focus on it, a finger down on
// it — instead of whenever it scrolls into view.
//
// Viewport prefetching fetches the full page payload for every link on screen, clicked or not: one
// view of the Team tab was fetching 12 pages in the background (~600 KB), each an edge request and
// a cache read on the host's free tier. Intent still gives the navigation a head start of a few
// hundred milliseconds, which is all a prerendered page needs to open instantly.

export function IntentLink({
  href,
  onPointerEnter,
  onFocus,
  onTouchStart,
  ...props
}: ComponentProps<typeof Link> & { href: string }) {
  const router = useRouter();
  const prefetch = () => router.prefetch(href);

  return (
    <Link
      href={href}
      prefetch={false}
      onPointerEnter={(event) => {
        prefetch();
        onPointerEnter?.(event);
      }}
      onFocus={(event) => {
        prefetch();
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        prefetch();
        onTouchStart?.(event);
      }}
      {...props}
    />
  );
}
