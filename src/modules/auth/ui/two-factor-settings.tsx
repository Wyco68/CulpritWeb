'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { KeyRound, MailWarning, ShieldCheck, ShieldOff } from 'lucide-react';
import { Button } from '@/modules/shared/ui/button';
import { Dialog, DialogFooter } from '@/modules/shared/ui/dialog';
import { FormSection } from '@/modules/shared/ui/form-section';
import { StatusPill } from '@/modules/shared/ui/status-pill';
import { twoFactor } from '../auth-client';
import { CODE_DIGITS, CODE_TTL_MINUTES } from '../auth-policy';
import { verificationCodeSchema } from '../two-factor.schema';
import { authErrorMessage, runAuthRequest, type AuthClientError } from './auth-error-message';
import { BackupCodesPanel, UnsavedCodesFooter, useUnsavedCodesGuard } from './backup-codes-panel';
import { CodeField } from './code-field';
import { FormAlert, FormNotice } from './form-alert';
import { PasswordConfirmForm } from './password-confirm-form';
import { ResendCodeButton } from './resend-code-button';
import { useResendCooldown } from './use-resend-cooldown';

// The admin's two-step verification settings (ADR-022): its state, turning it on and off, and
// replacing the backup codes. The page reads the state on the server and passes it in; every
// change ends in `router.refresh()`, so the server stays the one source of it.
//
// Turning it on is three steps in one dialog — password, save the backup codes, confirm an emailed
// code — because only the verified code switches it on: an address that can't receive the code
// never ends up as the second factor. The backup codes come back from the password step and are
// shown exactly once.

export interface TwoFactorSettingsProps {
  enabled: boolean;
  /** Whether the server has a mail transport. Without one, turning on is refused, so it's offered disabled. */
  emailConfigured: boolean;
  /** Where codes are sent: the admin's own address. */
  email: string;
}

type OpenDialog = 'enable' | 'disable' | 'regenerate' | null;

const EMAIL_NOT_CONFIGURED_NOTICE = "Email delivery isn't configured yet, so codes can't be sent.";

/** Turning two-step verification on or off ends every session but this one (ADR-022). */
const OTHER_SESSIONS = 'Other signed-in devices will be signed out.';

/** The confirm-code step was reached without a pending setup: start again from the password. */
function isSetupRequired(error: AuthClientError): boolean {
  return error.code === 'TWO_FACTOR_SETUP_REQUIRED';
}

export function TwoFactorSettings({ enabled, emailConfigured, email }: TwoFactorSettingsProps) {
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const onOpenChange = useCallback((open: boolean) => {
    if (!open) setDialog(null);
  }, []);
  const noticeId = 'two-factor-email-notice';

  return (
    <FormSection
      title="Two-step verification"
      badge={
        <StatusPill
          status={
            enabled
              ? { tone: 'ok', label: 'On', icon: ShieldCheck }
              : { tone: 'neutral', label: 'Off', icon: ShieldOff }
          }
        />
      }
      description={
        enabled
          ? `Signing in asks for your password, then an ${CODE_DIGITS}-digit code emailed to ${email}.`
          : `Add a second step to signing in: after your password, an ${CODE_DIGITS}-digit code emailed to ${email}.`
      }
    >
      <div className="flex flex-col gap-6">
        {!emailConfigured && (
          <p
            id={noticeId}
            className="flex items-start gap-2.5 rounded-md border border-warning/35 bg-warning-tint px-4 py-3 text-sm text-foreground"
          >
            <MailWarning className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <span>
              {EMAIL_NOT_CONFIGURED_NOTICE}{' '}
              {enabled
                ? 'Sign in with a backup code until it is.'
                : 'Two-step verification can be turned on once it is.'}
            </span>
          </p>
        )}

        {enabled ? (
          <>
            <SettingRow
              title="Backup codes"
              description="Ten one-time codes for signing in when you can't get to your email. Making new ones voids the old set."
              action={
                <Button type="button" variant="outline" onClick={() => setDialog('regenerate')}>
                  <KeyRound className="size-4" aria-hidden="true" />
                  Generate new codes
                </Button>
              }
            />
            <SettingRow
              title="Turn off"
              description={`Signing in will ask for your password only, and your backup codes stop working. ${OTHER_SESSIONS}`}
              action={
                <Button type="button" variant="destructive" onClick={() => setDialog('disable')}>
                  <ShieldOff className="size-4" aria-hidden="true" />
                  Turn off
                </Button>
              }
            />
          </>
        ) : (
          <SettingRow
            title="Protect the admin account"
            description={`A leaked or guessed password alone will no longer be enough to sign in. You'll also get backup codes for when your email is out of reach. ${OTHER_SESSIONS}`}
            action={
              <Button
                type="button"
                onClick={() => setDialog('enable')}
                disabled={!emailConfigured}
                aria-describedby={emailConfigured ? undefined : noticeId}
              >
                <ShieldCheck className="size-4" aria-hidden="true" />
                Turn on
              </Button>
            }
          />
        )}
      </div>

      <EnableDialog open={dialog === 'enable'} onOpenChange={onOpenChange} email={email} />
      <DisableDialog open={dialog === 'disable'} onOpenChange={onOpenChange} />
      <RegenerateDialog open={dialog === 'regenerate'} onOpenChange={onOpenChange} />
    </FormSection>
  );
}

function SettingRow({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <div className="min-w-0 max-w-[52ch]">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

interface FlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Turn on ────────────────────────────────────────────────────────────────────────────────────

type EnableStep = 'password' | 'codes' | 'verify';

const ENABLE_STEPS: Record<EnableStep, { title: string; description: string }> = {
  password: {
    title: 'Turn on two-step verification',
    description: 'Step 1 of 3. Confirm your password.',
  },
  codes: {
    title: 'Save your backup codes',
    description: "Step 2 of 3. Each code signs you in once if you can't get to your email.",
  },
  verify: {
    title: 'Confirm your email',
    description: `Step 3 of 3. Two-step verification turns on once you enter the code. ${OTHER_SESSIONS}`,
  },
};

function EnableDialog({ open, onOpenChange, email }: FlowDialogProps & { email: string }) {
  const router = useRouter();
  const [step, setStep] = useState<EnableStep>('password');
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  // Why the flow went back to the password step, shown there.
  const [restartReason, setRestartReason] = useState<string | null>(null);
  const guard = useUnsavedCodesGuard(open && step === 'codes' && !saved);

  // Every opening starts over; the codes never outlive the dialog.
  useEffect(() => {
    if (open) return;
    setStep('password');
    setCodes([]);
    setSaved(false);
    setSendError(null);
    setRestartReason(null);
  }, [open]);

  /** The server has no setup in progress (TWO_FACTOR_SETUP_REQUIRED): back to the password. */
  function restart(reason: string) {
    setCodes([]);
    setSaved(false);
    setSendError(null);
    setRestartReason(reason);
    setStep('password');
  }

  function cancel() {
    if (guard.beforeClose()) onOpenChange(false);
  }

  async function confirmPassword(password: string) {
    const { data, error } = await runAuthRequest(() => twoFactor.enable({ password }));
    if (error) return authErrorMessage(error, "Couldn't start turning on two-step verification.");
    setRestartReason(null);
    setCodes(data.backupCodes);
    setStep('codes');
    return null;
  }

  // The one place the confirming code is first sent: a click, never an effect.
  async function sendFirstCode() {
    setSendError(null);
    setSending(true);
    const { error } = await runAuthRequest(() => twoFactor.sendOtp());
    setSending(false);
    if (error) {
      const message = authErrorMessage(error, "Couldn't send the code. Please try again.");
      if (isSetupRequired(error)) return restart(message);
      setSendError(message);
      return;
    }
    setStep('verify');
  }

  function finish() {
    toast.success('Two-step verification is on.');
    onOpenChange(false);
    router.refresh();
  }

  const { title, description } = ENABLE_STEPS[step];

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      icon={ShieldCheck}
      size="sm"
      beforeClose={guard.beforeClose}
    >
      {/* The dialog's title isn't re-announced when it changes, so the step is, here. */}
      <p role="status" aria-live="polite" className="sr-only">
        {open && step !== 'password' ? `${title}. ${description}` : ''}
      </p>

      {open && step === 'password' && (
        <PasswordConfirmForm
          // A new key per restart, so the form remounts showing the reason.
          key={restartReason ?? 'first'}
          id="enable-two-factor-password"
          submitLabel="Continue"
          initialError={restartReason}
          onConfirm={confirmPassword}
          onCancel={() => onOpenChange(false)}
        />
      )}

      {open && step === 'codes' && (
        <div className="flex flex-col gap-5">
          {sendError && <FormAlert>{sendError}</FormAlert>}
          <BackupCodesPanel codes={codes} saved={saved} onSavedChange={setSaved} focusOnMount />
          {guard.confirming ? (
            <UnsavedCodesFooter
              consequence="Two-step verification stays off; turning it on later makes new codes."
              onKeep={guard.keep}
              onCloseAnyway={() => onOpenChange(false)}
            />
          ) : (
            <DialogFooter>
              <Button type="button" variant="outline" onClick={cancel}>
                Cancel
              </Button>
              <Button type="button" onClick={sendFirstCode} disabled={!saved} loading={sending}>
                Email me a code
              </Button>
            </DialogFooter>
          )}
        </div>
      )}

      {open && step === 'verify' && (
        <VerifyEnableForm
          email={email}
          onVerified={finish}
          onSetupRequired={restart}
          onCancel={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

type CodeInput = z.input<typeof verificationCodeSchema>;
type CodeOutput = z.output<typeof verificationCodeSchema>;

function VerifyEnableForm({
  email,
  onVerified,
  onSetupRequired,
  onCancel,
}: {
  email: string;
  onVerified: () => void;
  onSetupRequired: (reason: string) => void;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);
  const cooldown = useResendCooldown({ startActive: true });

  const {
    register,
    handleSubmit,
    setFocus,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<CodeInput, unknown, CodeOutput>({
    resolver: zodResolver(verificationCodeSchema),
    defaultValues: { code: '' },
  });

  useEffect(() => {
    setFocus('code');
  }, [setFocus]);

  async function onSubmit({ code }: CodeOutput) {
    setFormError(null);
    const { error } = await runAuthRequest(() => twoFactor.verifyOtp({ code }));
    if (error) {
      const message = authErrorMessage(error, "Couldn't verify the code. Please try again.");
      if (isSetupRequired(error)) return onSetupRequired(message);
      setNotice(null);
      setFormError(message);
      resetField('code');
      setFocus('code');
      return;
    }
    setVerified(true);
    onVerified();
  }

  async function resend() {
    setFormError(null);
    setResending(true);
    const { error } = await runAuthRequest(() => twoFactor.sendOtp());
    setResending(false);
    if (error) {
      const message = authErrorMessage(error, "Couldn't send a new code. Please try again.");
      if (isSetupRequired(error)) return onSetupRequired(message);
      setNotice(null);
      setFormError(message);
      return;
    }
    cooldown.start();
    setNotice(`A new code is on its way to ${email}.`);
    setFocus('code');
  }

  const busy = isSubmitting || verified;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {formError && <FormAlert>{formError}</FormAlert>}
      <FormNotice message={notice} />
      <CodeField
        id="enable-two-factor-code"
        registration={register('code')}
        error={errors.code?.message}
        description={`We emailed an ${CODE_DIGITS}-digit code to ${email}. It expires ${CODE_TTL_MINUTES} minutes after it was sent.`}
      />
      <div className="flex justify-start">
        <ResendCodeButton
          onResend={resend}
          remaining={cooldown.remaining}
          loading={resending}
          disabled={busy}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Turn on
        </Button>
      </DialogFooter>
    </form>
  );
}

// ── Turn off ───────────────────────────────────────────────────────────────────────────────────

function DisableDialog({ open, onOpenChange }: FlowDialogProps) {
  const router = useRouter();

  async function confirmPassword(password: string) {
    const { error } = await runAuthRequest(() => twoFactor.disable({ password }));
    if (error) return authErrorMessage(error, "Couldn't turn off two-step verification.");
    toast.success('Two-step verification is off.');
    onOpenChange(false);
    router.refresh();
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Turn off two-step verification?"
      description={`Signing in will ask for your password only, and your backup codes stop working. ${OTHER_SESSIONS}`}
      icon={ShieldOff}
      tone="destructive"
      size="sm"
    >
      {open && (
        <PasswordConfirmForm
          id="disable-two-factor-password"
          submitLabel="Turn off"
          variant="destructive"
          onConfirm={confirmPassword}
          onCancel={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

// ── New backup codes ───────────────────────────────────────────────────────────────────────────

function RegenerateDialog({ open, onOpenChange }: FlowDialogProps) {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const guard = useUnsavedCodesGuard(open && codes !== null && !saved);

  useEffect(() => {
    if (open) return;
    setCodes(null);
    setSaved(false);
  }, [open]);

  async function confirmPassword(password: string) {
    const { data, error } = await runAuthRequest(() => twoFactor.generateBackupCodes({ password }));
    if (error) return authErrorMessage(error, "Couldn't generate new backup codes.");
    setCodes(data.backupCodes);
    toast.success('New backup codes generated. The old ones no longer work.');
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={codes ? 'Save your new backup codes' : 'Generate new backup codes?'}
      description={
        codes
          ? "They won't be shown again. Each one signs you in once."
          : 'Your current backup codes stop working as soon as the new ones are made.'
      }
      icon={KeyRound}
      size="sm"
      beforeClose={guard.beforeClose}
    >
      {open && !codes && (
        <PasswordConfirmForm
          id="regenerate-backup-codes-password"
          submitLabel="Generate codes"
          onConfirm={confirmPassword}
          onCancel={() => onOpenChange(false)}
        />
      )}
      {open && codes && (
        <div className="flex flex-col gap-5">
          <BackupCodesPanel codes={codes} saved={saved} onSavedChange={setSaved} focusOnMount />
          {guard.confirming ? (
            <UnsavedCodesFooter
              consequence="Your old codes already stopped working; you can generate another set."
              onKeep={guard.keep}
              onCloseAnyway={() => onOpenChange(false)}
            />
          ) : (
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)} disabled={!saved}>
                Done
              </Button>
            </DialogFooter>
          )}
        </div>
      )}
    </Dialog>
  );
}
