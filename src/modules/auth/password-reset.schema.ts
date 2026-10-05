import { z } from 'zod';
import { CODE_DIGITS, PASSWORD_POLICY } from './auth-policy';

// Client-side UX validation for "forgot password" by emailed code (ADR-022, ADR-023). The source of
// truth is Better Auth's /api/auth/email-otp/* handlers plus the length check in ./auth-security.ts,
// which runs before the code is spent. Same numbers on both sides, from ./auth-policy.ts.
//
// There is no email field: the server always acts on ADMIN_EMAIL, whatever a client sends, so the
// form sends `email: ''` itself. Asking for a code takes no input at all — only the human check.

const CODE_PATTERN = new RegExp(`^\\d{${CODE_DIGITS}}$`);

/** The code from the email and the new password. `confirmPassword` never leaves the form. */
export const resetPasswordSchema = z
  .object({
    otp: z
      .string()
      .transform((value) => value.replace(/\s+/g, ''))
      .pipe(z.string().regex(CODE_PATTERN, `Enter the ${CODE_DIGITS}-digit code from the email.`)),
    password: z
      .string()
      .min(
        PASSWORD_POLICY.minPasswordLength,
        `Use at least ${PASSWORD_POLICY.minPasswordLength} characters.`,
      )
      .max(
        PASSWORD_POLICY.maxPasswordLength,
        `Use at most ${PASSWORD_POLICY.maxPasswordLength} characters.`,
      ),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "The passwords don't match.",
    path: ['confirmPassword'],
  });
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
