// auth module — Better Auth single-admin config (cookie sessions, httpOnly + secure, NOT JWT) and
// the requireAdmin() guard re-checked at every admin boundary. Login/logout are served by Better
// Auth's own handler at /api/auth/[...all].

export { auth, type Auth } from './auth';
export { requireAdmin, type AdminSession } from './require-admin';
export { authClient, signIn, signOut, useSession } from './auth-client';
export { loginSchema, type LoginInput } from './login.schema';
export { LoginForm } from './ui/login-form';
export { LogoutButton } from './ui/logout-button';
