// auth module — Better Auth single-admin config (cookie sessions, httpOnly + secure, NOT JWT) and
// the requireAdmin() guard re-checked at every admin boundary. Login/logout, the mandatory
// emailed-code second factor and forgot-password-by-code (ADR-022, ADR-023) are all served by
// Better Auth's own handler at /api/auth/[...all].

export { auth, type Auth } from './auth';
export { requireAdmin, type AdminSession } from './require-admin';
export { authClient, signIn, signOut, useSession, twoFactor, emailOtp } from './auth-client';
// Only the MASKED admin address is public: the full one stays inside the module (ADR-023).
export {
  ADMIN_EMAIL_MASKED,
  CODE_DIGITS,
  CODE_TTL_MINUTES,
  TWO_FACTOR_CODE_ATTEMPTS,
  RESET_CODE_ATTEMPTS,
  PASSWORD_POLICY,
  EMAIL_DELIVERY_FAILED,
  TWO_FACTOR_SIGN_IN_ONLY,
  TWO_FACTOR_SETUP_FAILED,
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
export { resetPasswordSchema, type ResetPasswordInput } from './password-reset.schema';
export { LoginForm, type LoginFormProps } from './ui/login-form';
export { ForgotPasswordForm, type ForgotPasswordFormProps } from './ui/forgot-password-form';
export { TwoFactorSettings, type TwoFactorSettingsProps } from './ui/two-factor-settings';
export { LogoutButton } from './ui/logout-button';
