// auth module — Better Auth single-admin config (cookie sessions, httpOnly + secure, NOT JWT) and
// the requireAdmin() guard re-checked at every admin boundary. Login/logout are served by Better
// Auth's own handler at /api/auth/[...all].

export { auth, type Auth } from './auth';
export { requireAdmin, type AdminSession } from './require-admin';
