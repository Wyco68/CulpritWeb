import { z } from 'zod';
import { CODE_DIGITS, PASSWORD_POLICY } from './auth-policy';

// Client-side UX validation for "forgot password" by emailed code (ADR-022). The source of truth is
// Better Auth's /api/auth/email-otp/* handlers plus the length check in ./auth-security.ts, which
// runs before the code is spent. Same numbers on both sides, from ./auth-policy.ts.

const CODE_PATTERN = new RegExp(`^\\d{${CODE_DIGITS}}$`);

const email = z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.');

/** Step 1 — ask for a code. The server answers the same whether or not the address has an account. */
export const requestPasswordResetSchema = z.object({ email });
export type RequestPasswordResetInput = z.input<typeof requestPasswordResetSchema>;

/** Step 2 — the code from the email and the new password. `confirmPassword` never leaves the form. */
export const resetPasswordSchema = z
  .object({
    email,
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
