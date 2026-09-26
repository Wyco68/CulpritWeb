'use client';

import { useEffect, useRef } from 'react';

// Condenses the pinned public header once the reader scrolls away from the top of the page: the
// full band (name, tagline, affiliation) becomes a compact one (name and the appointment action).
// A pinned 184px band would otherwise hold a quarter of a laptop screen for the whole visit.
//
// Driven by an IntersectionObserver on a sentinel at the top of the document, not a scroll
// listener: the callback fires only when the threshold is crossed. It sets one attribute on
// <html>; everything else — the band's height, the sticky offsets of the sidebar and the section
// nav, the anchor offset — follows from `--header-h` in globals.css. Below `lg` the attribute has
// no effect, since the header is not pinned there.
export function HeaderCondenser() {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;
    const root = document.documentElement;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) delete root.dataset.headerCondensed;
      else root.dataset.headerCondensed = '';
    });
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
      // <html> outlives this component (it persists across client navigations, into the admin).
      delete root.dataset.headerCondensed;
    };
  }, []);

  return (
    <div
      ref={sentinelRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-16"
    />
  );
}
