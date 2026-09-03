'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from './confirm-dialog';

// Stops a half-finished edit from being thrown away by a stray navigation. The admin screens are
// the longest forms in the product — the About screen alone carries the whole public masthead —
// and until now nothing anywhere in the app noticed that a form was dirty when you clicked a tab.
//
// Two escape routes have to be covered, and the platform only gives us one of them for free:
//
// 1. Leaving the document (reload, close, typing a new URL) — `beforeunload`. The browser draws
//    its own generic dialog; the text is not ours to choose.
// 2. Client-side navigation inside the app — the App Router deliberately exposes no navigation
//    blocking API (`next/navigation` has no `useBlocker`), so the only interception point is the
//    click itself. A capture-phase document listener catches the anchor before Next's own handler
//    sees it, and we replace the browser's confirm() with the app's `ConfirmDialog` — styled,
//    focus-trapped and assertable in tests, which `window.confirm` is none of.
//
// The listener deliberately does NOT fire for modified clicks (new tab/window), downloads,
// cross-origin links or same-path fragment links: none of those discard the form.

export interface UnsavedChangesGuardProps {
  /** Usually React Hook Form's `formState.isDirty`. */
  when: boolean;
  /** Overrides the dialog body when a screen can say something more specific. */
  description?: string;
}

export function UnsavedChangesGuard({ when, description }: UnsavedChangesGuardProps) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  // Set the instant the admin confirms, so our own `router.push` isn't caught by the listener
  // that is still attached for the rest of this tick.
  const bypass = useRef(false);

  useEffect(() => {
    if (!when) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Legacy assignment: Safari and older Chrome still require it to show the prompt.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [when]);

  useEffect(() => {
    if (!when) return;

    const handleClick = (event: MouseEvent) => {
      if (bypass.current || event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      // A jump link inside this very screen keeps the form mounted, so nothing is lost.
      if (destination.pathname === window.location.pathname) return;

      event.preventDefault();
      event.stopPropagation();
      setPendingHref(`${destination.pathname}${destination.search}${destination.hash}`);
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [when]);

  return (
    <ConfirmDialog
      open={pendingHref !== null}
      onOpenChange={(open) => {
        if (!open) setPendingHref(null);
      }}
      title="Leave without saving?"
      description={
        description ?? 'This page has changes that have not been saved. Leaving now discards them.'
      }
      confirmLabel="Discard changes"
      cancelLabel="Keep editing"
      onConfirm={() => {
        const href = pendingHref;
        bypass.current = true;
        setPendingHref(null);
        if (href) router.push(href);
      }}
    />
  );
}
