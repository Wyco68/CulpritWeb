import * as React from 'react';
import { cn } from '@/modules/shared/lib/utils';
import { fieldClassName } from './input';

// Shares `fieldClassName` with Input and Select so all three read as one control family. Kept
// visibly taller than a single-line input and left vertically resizable — the height and the grab
// handle are what tell a user this field takes a paragraph rather than a line.
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(fieldClassName, 'flex min-h-24 resize-y px-3 py-2 leading-relaxed', className)}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
