'use client';

import { createAuthClient } from 'better-auth/react';
import { publicEnv } from '@/modules/shared/lib/env';

// Better Auth's React client — cookie-session aware (`credentials: 'include'` by default), talks
// to the server handler mounted at `/api/auth/[...all]`. Pointed at the app's own origin so it
// works identically in every environment without a separate "API base URL" to configure.
export const authClient = createAuthClient({
  baseURL: publicEnv.appUrl || undefined,
});

export const { signIn, signOut, useSession } = authClient;
