import * as React from 'react';
import { cn } from '@/modules/shared/lib/utils';
import { Label } from './label';

// The one reusable form-field wrapper (label + control + description + accessible error) used by
// every admin form. Wires `aria-invalid`/`aria-describedby` onto the control so screen readers
// announce validation state and the linked hint/error text — never a bare error <p> floating
// unassociated from its input. `htmlFor`/`id` are generated once via useId and threaded through,
// so callers never hand-roll ids that could collide.

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
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-destructive">
            *
          </span>
        )}
      </Label>
      {children({ id: htmlFor, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {description && (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" aria-live="polite" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
