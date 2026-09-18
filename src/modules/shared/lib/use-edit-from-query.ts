'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Opens a dialog for the record named in a query parameter — how the dashboard links straight to
 * one record (`?edit=<id>`, `?profile=<id>`) instead of to the list it lives in. The parameter is
 * removed once used, so closing the dialog, a refresh or the Back button doesn't reopen it.
 */
export function useOpenFromQuery<T extends { id: string }>(
  param: string,
  items: readonly T[],
  onOpen: (item: T) => void,
) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const handled = useRef<string | null>(null);
  const id = params.get(param);

  useEffect(() => {
    if (!id || handled.current === id) return;
    handled.current = id;
    const item = items.find((candidate) => candidate.id === id);
    if (item) onOpen(item);
    router.replace(pathname, { scroll: false });
  }, [id, items, onOpen, pathname, router]);
}

/** A table's edit dialog, from `?edit=<id>`. */
export function useEditFromQuery<T extends { id: string }>(
  items: readonly T[],
  onEdit: (item: T) => void,
) {
  useOpenFromQuery('edit', items, onEdit);
}
