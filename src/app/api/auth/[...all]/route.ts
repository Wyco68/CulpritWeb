import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/modules/auth';

// Better Auth serves login/logout/session here (POST /api/auth/sign-in/email, /sign-out, etc.).
// Public sign-up is disabled in the auth config (single admin).
export const { GET, POST } = toNextJsHandler(auth);
