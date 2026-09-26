'use client';

import * as React from 'react';
import { CircleAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/modules/shared/lib/utils';
import { Button } from './button';
import { Dialog, DialogFooter } from './dialog';

// The one editing popup every admin form uses (research, publications, team members, events,
// courses, CV entries, projects), so they all behave the same way:
//
//  - Fields are grouped under short headings (`FormGroup`), with short fields side by side.
//  - Typed input is never thrown away by accident: once the form is dirty, Escape, the backdrop,
//    the close button and Cancel ask to discard first, in the footer, instead of closing.
//  - One submit label everywhere ("Save changes" — the page's own "Add" button already names the
//    record being created), and Ctrl/Cmd + Enter submits from any field, including a textarea,
//    where plain Enter is a new line.
//  - When a submit is blocked by validation, a summary says how many fields need attention (the
//    form library already moves focus to the first of them).
//
// The caller keeps its own form library wiring: it passes the submit handler, the in-flight flag,
// the dirty flag and the number of errors.

export interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  size?: 'sm' | 'md' | 'lg';
  /** The form's submit handler, e.g. React Hook Form's `handleSubmit(onValid)`. */
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
  submitLabel?: string;
  /** Whether the form holds input that has not been saved. */
  dirty: boolean;
  /** Fields currently failing validation. Shown as a summary above the form when non-zero. */
  errorCount?: number;
  children: React.ReactNode;
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  icon,
  size = 'md',
  onSubmit,
  submitting,
  submitLabel = 'Save changes',
  dirty,
  errorCount = 0,
  children,
}: FormDialogProps) {
  const [confirmingDiscard, setConfirmingDiscard] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  // Every opening starts without a pending discard question.
  React.useEffect(() => {
    if (!open) setConfirmingDiscard(false);
  }, [open]);

  /** Asked before any user-initiated close. Dirty input turns the close into a question. */
  const beforeClose = () => {
    if (!dirty || submitting) return true;
    setConfirmingDiscard(true);
    return false;
  };

  const cancel = () => {
    if (beforeClose()) onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      icon={icon}
      size={size}
      beforeClose={beforeClose}
    >
      <form
        ref={formRef}
        onSubmit={onSubmit}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
        noValidate
        className="flex flex-col gap-7"
      >
        {errorCount > 0 && (
          // Visual only, no live role: each field already announces its own error (role="alert"
          // in FormField) and focus moves to the first of them, so a second announcement here
          // would just repeat it.
          <div className="flex items-start gap-2.5 rounded-md border border-destructive/25 bg-destructive-tint px-4 py-3 text-sm text-foreground">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
            {errorCount === 1
              ? 'One field needs attention before this can be saved.'
              : `${errorCount} fields need attention before this can be saved.`}
          </div>
        )}

        {children}

        <DialogFooter className={cn(confirmingDiscard && 'bg-warning-tint')}>
          {confirmingDiscard ? (
            // Asked in place rather than in a second modal: the question is about this form, and
            // the answer is one click either way.
            <>
              <p
                role="alert"
                className="mr-auto text-sm font-medium text-warning max-sm:basis-full max-sm:text-center"
              >
                Discard your unsaved changes?
              </p>
              <Button type="button" variant="outline" onClick={() => setConfirmingDiscard(false)}>
                Keep editing
              </Button>
              <Button type="button" variant="destructive" onClick={() => onOpenChange(false)}>
                Discard
              </Button>
            </>
          ) : (
            <>
              <p className="mr-auto hidden text-xs text-muted-foreground sm:block">
                <span className="text-destructive">*</span> Required
                <span className="mx-2 text-border-strong" aria-hidden="true">
                  |
                </span>
                <kbd className="font-sans">Ctrl</kbd> or <kbd className="font-sans">⌘</kbd> +{' '}
                <kbd className="font-sans">Enter</kbd> to save
              </p>
              <Button type="button" variant="outline" onClick={cancel}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                {submitLabel}
              </Button>
            </>
          )}
        </DialogFooter>
      </form>
    </Dialog>
  );
}

/**
 * A titled group of fields inside a FormDialog. `columns={2}` sets short fields side by side from
 * `sm` up; give a field `className="sm:col-span-2"` to span both columns.
 */
export function FormGroup({
  title,
  description,
  columns = 1,
  children,
}: {
  title: string;
  description?: string;
  columns?: 1 | 2;
  children: React.ReactNode;
}) {
  const headingId = React.useId();
  return (
    <section
      aria-labelledby={headingId}
      className="border-t border-border pt-6 first-of-type:border-t-0 first-of-type:pt-0"
    >
      <div className="mb-4">
        <h3 id={headingId} className="text-sm font-semibold text-foreground">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-pretty text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className={cn('grid gap-5', columns === 2 && 'sm:grid-cols-2')}>{children}</div>
    </section>
  );
}
