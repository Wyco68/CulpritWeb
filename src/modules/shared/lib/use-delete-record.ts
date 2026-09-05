'use client';

import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiDelete } from './api-client';

/**
 * The delete-with-confirmation flow every admin table runs: pick a record, confirm, DELETE, then
 * refresh the Server Component that supplied the rows.
 *
 * Returns the mechanical half of the `ConfirmDialog` wiring; each screen still writes its own
 * title and description, because what the admin needs to be told before deleting differs per
 * record type.
 */
export function useDeleteRecord<T extends { id: string }>(endpointFor: (id: string) => string) {
  const router = useRouter();
  const [target, setTarget] = useState<T | undefined>(undefined);
  const sectionToRefocus = useRef<HTMLElement | null>(null);

  const mutation = useMutation({
    mutationFn: apiDelete,
    onSuccess: () => {
      toast.success('Deleted.');
      setTarget(undefined);
      router.refresh();
      restoreFocus();
    },
    onError: () => toast.error('Could not delete. Please try again.'),
  });

  /**
   * The dialog hands focus back to whatever opened it, but that was the deleted row's button and
   * it no longer exists — focus would land on `<body>`, losing the keyboard user's place
   * (WCAG 2.4.3). Move it to the surrounding section instead, whose heading names where they are.
   * Deferred to the next frame so it runs after the dialog's own close-and-restore.
   */
  function restoreFocus() {
    const section = sectionToRefocus.current;
    sectionToRefocus.current = null;
    if (!section) return;
    requestAnimationFrame(() => {
      if (!section.isConnected) return;
      section.tabIndex = -1;
      section.focus();
    });
  }

  return {
    /** Open the confirmation for one record. */
    request: (record: T) => {
      const trigger = document.activeElement;
      sectionToRefocus.current = trigger instanceof HTMLElement ? trigger.closest('section') : null;
      setTarget(record);
    },
    dialogProps: {
      open: Boolean(target),
      onOpenChange: (open: boolean) => {
        if (!open) setTarget(undefined);
      },
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      loading: mutation.isPending,
      onConfirm: () => {
        if (target) mutation.mutate(endpointFor(target.id));
      },
    },
  };
}
