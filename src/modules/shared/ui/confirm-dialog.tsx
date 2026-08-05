'use client';

import { Dialog } from './dialog';
import { Button } from './button';

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
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={variant} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
