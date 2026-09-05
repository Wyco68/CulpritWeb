'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { Button } from './button';

/**
 * The edit/delete pair every admin table ends its rows with. The labels are per-row rather than
 * generic ("Edit: <title>") so a screen reader announces which record each button acts on.
 */
export function RowActions({
  editLabel,
  deleteLabel,
  onEdit,
  onDelete,
  children,
}: {
  editLabel: string;
  deleteLabel: string;
  onEdit: () => void;
  onDelete: () => void;
  /** Extra buttons, rendered before Edit — e.g. the events table's Participants shortcut. */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex justify-end gap-1.5">
      {children}
      <Button variant="ghost" size="icon" aria-label={editLabel} onClick={onEdit}>
        <Pencil className="size-4" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={deleteLabel}
        className="text-destructive hover:bg-destructive/10"
        onClick={onDelete}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
