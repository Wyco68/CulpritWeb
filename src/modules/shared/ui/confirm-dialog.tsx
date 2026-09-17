'use client';

import { useEffect, useId, useState } from 'react';
import { Dialog, DialogFooter } from './dialog';
import { Button } from './button';
import { Input } from './input';

// Reusable destructive-action confirmation step (delete / decline / cancel) built on the shared
// `Dialog`. Every irreversible or status-changing admin action routes through this instead of a
// one-off `window.confirm` (which is unstyled, blocks the main thread, and fails automated tests).
export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  variant?: 'destructive' | 'default';
  /**
   * When set, the confirm button stays disabled until the admin types this exact text — the
   * record's name. A deliberate step for deletes that cannot be undone.
   */
  confirmationText?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  loading = false,
  variant = 'destructive',
  confirmationText,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const inputId = useId();
  // Each opening starts empty, so a name typed for one record never pre-confirms the next.
  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);
  const confirmed = !confirmationText || typed.trim() === confirmationText.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      {confirmationText && (
        <div className="mb-4 space-y-2">
          <label htmlFor={inputId} className="block text-sm text-foreground">
            Type <span className="font-semibold break-words">{confirmationText}</span> to confirm.
          </label>
          <Input
            id={inputId}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="h-10 px-3"
          />
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={variant} onClick={onConfirm} loading={loading} disabled={!confirmed}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
