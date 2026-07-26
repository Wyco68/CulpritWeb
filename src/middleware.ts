import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// next-intl locale negotiation. The admin route guard (Better Auth session check)
// will be composed here once the auth module lands — see modules/auth.
export default createMiddleware(routing);

export const config = {
  // Match all paths except API, Next internals, and static files.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
