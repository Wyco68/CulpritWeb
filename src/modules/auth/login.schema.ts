import { z } from 'zod';

// Client-side UX validation for the single-admin login form. There is no server-side "login"
// schema to mirror — Better Auth's own `/api/auth/sign-in/email` handler is the source of truth
// for credential validation; this only prevents an obviously-empty/malformed submit round trip.
export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});
export type LoginInput = z.infer<typeof loginSchema>;
