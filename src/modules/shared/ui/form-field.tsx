import * as React from 'react';
import { cn } from '@/modules/shared/lib/utils';
import { Label } from './label';

// The one reusable form-field wrapper (label + control + description + accessible error) used by
// every admin form. Wires `aria-invalid`/`aria-describedby` onto the control so screen readers
// announce validation state and the linked hint/error text — never a bare error <p> floating
// unassociated from its input. `htmlFor`/`id` are generated once via useId and threaded through,
// so callers never hand-roll ids that could collide.
//
// Two corrections to the earlier version:
//
// 1. "Required" is now announced. It was marked with an `aria-hidden` asterisk only, and the
//    controls carry no `required` attribute (the forms are `noValidate`, with Zod as the
//    authority), so a screen-reader user had no way to know a field was mandatory. The asterisk
//    stays for sighted users and is paired with visually-hidden text.
// 2. The description sits above the control rather than below it. It explains what to enter, so
//    it is only useful before you type — and `aria-describedby` is announced after the label, so
//    the visual order now matches the spoken one.

export interface FormFieldProps {
  label: string;
  htmlFor: string;
  description?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (fieldProps: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
  }) => React.ReactNode;
}

export function FormField({
  label,
  htmlFor,
  description,
  error,
  required,
  className,
  children,
}: FormFieldProps) {
  const descriptionId = description ? `${htmlFor}-description` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <>
            <span aria-hidden="true" className="ml-1 text-destructive">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        )}
      </Label>

      {description && (
        <p id={descriptionId} className="-mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}

      {children({ id: htmlFor, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}

      {error && (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          className="text-xs font-medium text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
