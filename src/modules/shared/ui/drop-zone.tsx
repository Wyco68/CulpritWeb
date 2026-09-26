'use client';

import * as React from 'react';
import { cn } from '@/modules/shared/lib/utils';
import { FRAMER_ACCEPTED_TYPES } from './photo-framer';

// A dashed area photos can be dragged onto. It adds a faster route for a mouse user and replaces
// nothing: the upload button inside it stays the keyboard- and touch-accessible way in, so the
// zone itself is not a control and takes no focus.
//
// Only image types the photo framer accepts get through; anything else dropped is ignored rather
// than handed on to fail later.

const ACCEPTED = new Set(FRAMER_ACCEPTED_TYPES.split(','));

export function DropZone({
  onFiles,
  disabled = false,
  multiple = false,
  className,
  children,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  multiple?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [dragging, setDragging] = React.useState(false);
  // dragenter/dragleave fire for every child the pointer crosses; a depth count tells a real
  // exit from moving between the zone's own children.
  const depth = React.useRef(0);

  const hasFiles = (event: React.DragEvent) => event.dataTransfer.types.includes('Files');

  return (
    <div
      onDragEnter={(event) => {
        if (disabled || !hasFiles(event)) return;
        event.preventDefault();
        depth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (disabled || !hasFiles(event)) return;
        // Required for the drop event to fire at all.
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      }}
      onDrop={(event) => {
        if (disabled || !hasFiles(event)) return;
        event.preventDefault();
        depth.current = 0;
        setDragging(false);
        const files = Array.from(event.dataTransfer.files).filter((file) =>
          ACCEPTED.has(file.type),
        );
        if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1));
      }}
      className={cn(
        'rounded-lg border-2 border-dashed p-4 transition-colors duration-200',
        dragging ? 'border-accent bg-success-tint' : 'border-border-strong bg-surface',
        disabled && 'opacity-60',
        className,
      )}
    >
      {children}
    </div>
  );
}
