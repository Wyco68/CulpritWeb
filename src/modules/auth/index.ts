// auth module — Better Auth single-admin config (cookie sessions, httpOnly + secure, NOT JWT) and
// the requireAdmin() guard re-checked at every admin boundary. Login/logout, the emailed-code second
// factor and forgot-password-by-code (ADR-022) are all served by Better Auth's own handler at
// /api/auth/[...all].

export { auth, type Auth } from './auth';
export { requireAdmin, type AdminSession } from './require-admin';
export { authClient, signIn, signOut, useSession, twoFactor, emailOtp } from './auth-client';
export {
  CODE_DIGITS,
  CODE_TTL_MINUTES,
  TWO_FACTOR_CODE_ATTEMPTS,
  RESET_CODE_ATTEMPTS,
  PASSWORD_POLICY,
  EMAIL_NOT_CONFIGURED,
  EMAIL_DELIVERY_FAILED,
  TWO_FACTOR_SETUP_REQUIRED,
  CAPTCHA_NOT_CONFIGURED,
  CAPTCHA_HEADER,
  RESET_BUDGET_EXHAUSTED,
} from './auth-policy';
export { loginSchema, type LoginInput } from './login.schema';
export {
  verificationCodeSchema,
  backupCodeSchema,
  confirmPasswordSchema,
  type VerificationCodeInput,
  type BackupCodeInput,
  type ConfirmPasswordInput,
} from './two-factor.schema';
export {
  requestPasswordResetSchema,
  resetPasswordSchema,
  type RequestPasswordResetInput,
  type ResetPasswordInput,
} from './password-reset.schema';
export { LoginForm } from './ui/login-form';
export { ForgotPasswordForm } from './ui/forgot-password-form';
export { TwoFactorSettings, type TwoFactorSettingsProps } from './ui/two-factor-settings';
export { LogoutButton } from './ui/logout-button';
