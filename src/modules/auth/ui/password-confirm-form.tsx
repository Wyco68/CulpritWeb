'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/modules/shared/ui/button';
import { DialogFooter } from '@/modules/shared/ui/dialog';
import { FormField } from '@/modules/shared/ui/form-field';
import { Input } from '@/modules/shared/ui/input';
import { confirmPasswordSchema, type ConfirmPasswordInput } from '../two-factor.schema';
import { FormAlert } from './form-alert';

// "Enter your password to continue" — the first step of turning two-step verification on or off
// and of replacing the backup codes. Lives inside a Dialog; the caller performs the request and
// answers with an error sentence, or null to move on.

export interface PasswordConfirmFormProps {
  id: string;
  submitLabel: string;
  variant?: 'default' | 'destructive';
  /** Shown above the field on mount, e.g. why a flow came back to this step. */
  initialError?: string | null;
  onConfirm: (password: string) => Promise<string | null>;
  onCancel: () => void;
}

export function PasswordConfirmForm({
  id,
  submitLabel,
  variant = 'default',
  initialError = null,
  onConfirm,
  onCancel,
}: PasswordConfirmFormProps) {
  const [formError, setFormError] = useState<string | null>(initialError);
  const {
    register,
    handleSubmit,
    setFocus,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<ConfirmPasswordInput>({
    resolver: zodResolver(confirmPasswordSchema),
    defaultValues: { password: '' },
  });

  // Mounted as its dialog opens. A frame later, because the dialog's own `showModal()` runs after
  // this effect and moves focus to its first control, the close button.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setFocus('password'));
    return () => cancelAnimationFrame(frame);
  }, [setFocus]);

  async function onSubmit({ password }: ConfirmPasswordInput) {
    setFormError(null);
    const message = await onConfirm(password);
    if (message) {
      setFormError(message);
      resetField('password');
      setFocus('password');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {formError && <FormAlert>{formError}</FormAlert>}
      <FormField
        label="Current password"
        htmlFor={id}
        description="Confirm it's you before changing how you sign in."
        error={errors.password?.message}
        required
      >
        {(fieldProps) => (
          <Input
            {...fieldProps}
            {...register('password')}
            type="password"
            autoComplete="current-password"
          />
        )}
      </FormField>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" variant={variant} loading={isSubmitting}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
