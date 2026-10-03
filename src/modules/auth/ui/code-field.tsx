import type { UseFormRegisterReturn } from 'react-hook-form';
import { FormField } from '@/modules/shared/ui/form-field';
import { Input } from '@/modules/shared/ui/input';
import { CODE_DIGITS } from '../auth-policy';

// The one input for an emailed code or a backup code: a single text field rather than one box per
// digit, so pasting works, a password manager or the OS can fill it (`one-time-code`), and a screen
// reader meets one labelled control. The schemas drop spaces, so `maxLength` leaves room for a
// pasted code that picked up whitespace — a hard 8 would silently cut its last digit.

export interface CodeFieldProps {
  id: string;
  registration: UseFormRegisterReturn;
  error?: string;
  /** `emailed`: the 8-digit code. `backup`: a one-time `xxxxx-xxxxx` code. */
  kind?: 'emailed' | 'backup';
  label?: string;
  description?: string;
}

export function CodeField({
  id,
  registration,
  error,
  kind = 'emailed',
  label,
  description,
}: CodeFieldProps) {
  const emailed = kind === 'emailed';
  return (
    <FormField
      label={label ?? (emailed ? 'Verification code' : 'Backup code')}
      htmlFor={id}
      description={description}
      error={error}
      required
    >
      {(fieldProps) => (
        <Input
          {...fieldProps}
          {...registration}
          type="text"
          inputMode={emailed ? 'numeric' : 'text'}
          autoComplete={emailed ? 'one-time-code' : 'off'}
          pattern={emailed ? '[0-9 ]*' : undefined}
          maxLength={emailed ? CODE_DIGITS + 4 : 15}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          className="h-11 font-mono text-base tracking-[0.2em]"
        />
      )}
    </FormField>
  );
}
