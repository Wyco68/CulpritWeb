import { z } from 'zod';
import { CODE_DIGITS } from './auth-policy';

// Client-side UX validation for the two-step verification forms (ADR-022). As with loginSchema, the
// source of truth is Better Auth's own handlers under /api/auth/two-factor/* — these only stop an
// obviously malformed submit from costing one of the code's limited attempts.

const CODE_PATTERN = new RegExp(`^\\d{${CODE_DIGITS}}$`);

/** The emailed sign-in code — and the code that confirms turning 2FA on. Spaces are dropped. */
export const verificationCodeSchema = z.object({
  code: z
    .string()
    .transform((value) => value.replace(/\s+/g, ''))
    .pipe(z.string().regex(CODE_PATTERN, `Enter the ${CODE_DIGITS}-digit code from the email.`)),
});
export type VerificationCodeInput = z.input<typeof verificationCodeSchema>;

/**
 * A one-time backup code, as shown when 2FA was turned on: `xxxxx-xxxxx`, letters and digits.
 * Compared exactly (case included) by the server, so only surrounding whitespace is trimmed.
 */
export const backupCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/, 'Enter a backup code, like abcde-12345.'),
});
export type BackupCodeInput = z.input<typeof backupCodeSchema>;

/** Current password, required to turn 2FA on or off and to replace the backup codes. */
export const confirmPasswordSchema = z.object({
  password: z.string().min(1, 'Password is required.'),
});
export type ConfirmPasswordInput = z.input<typeof confirmPasswordSchema>;
