'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, MailWarning, ShieldCheck } from 'lucide-react';
import { Button } from '@/modules/shared/ui/button';
import { Dialog, DialogFooter } from '@/modules/shared/ui/dialog';
import { FormSection } from '@/modules/shared/ui/form-section';
import { StatusPill } from '@/modules/shared/ui/status-pill';
import { twoFactor } from '../auth-client';
import { authErrorMessage, runAuthRequest } from './auth-error-message';
import { BackupCodesPanel, UnsavedCodesFooter, useUnsavedCodesGuard } from './backup-codes-panel';
import { PasswordConfirmForm } from './password-confirm-form';

// The admin's sign-in security (ADR-022, ADR-023). Two-step verification is mandatory, so there is
// no state to read and nothing to switch: this says where the codes go, warns when the server can't
// send them, and makes the backup codes — the way in when the mailbox is out of reach.
//
// The backup codes written when two-step verification started (automatically, at the first sign-in)
// are never shown to anyone, so the admin has no usable set until one is generated here. The server
// doesn't record whether a set was ever saved, so the prompt is always offered, never nagged.

export interface TwoFactorSettingsProps {
  /** Where sign-in codes are emailed, already masked (ADMIN_EMAIL_MASKED). */
  maskedEmail: string;
  /** Whether the server has a mail transport (RESEND_API_KEY + EMAIL_FROM). */
  emailConfigured: boolean;
}

export function TwoFactorSettings({ maskedEmail, emailConfigured }: TwoFactorSettingsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const onOpenChange = useCallback((open: boolean) => setDialogOpen(open), []);

  return (
    <FormSection
      title="Two-step verification"
      badge={<StatusPill status={{ tone: 'ok', label: 'Always on', icon: ShieldCheck }} />}
      description={`Two-step verification is always on. Sign-in codes are emailed to ${maskedEmail}.`}
    >
      <div className="flex flex-col gap-6">
        {!emailConfigured && <EmailUnavailableWarning />}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 max-w-[52ch]">
            <h3 className="text-sm font-semibold text-foreground">Backup codes</h3>
            <p className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">
              Your way in when the mailbox is out of reach: each code signs you in once, in place of
              the emailed code. Generate a set and keep it somewhere safe, offline. A new set
              replaces any earlier one.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => setDialogOpen(true)}>
            <KeyRound className="size-4" aria-hidden="true" />
            Generate backup codes
          </Button>
        </div>
      </div>

      <GenerateBackupCodesDialog open={dialogOpen} onOpenChange={onOpenChange} />
    </FormSection>
  );
}

/**
 * Shown when the server has no mail transport. Every sign-in needs an emailed code, so this is the
 * one state in which the admin can be locked out: said plainly, with the way around it. Present
 * from page load, so it is not a live region — it's the first thing in the section, read in order.
 */
function EmailUnavailableWarning() {
  return (
    <div className="flex items-start gap-3 rounded-md border border-warning/35 bg-warning-tint px-4 py-3 text-sm text-foreground">
      <MailWarning className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="font-semibold">Sign-in codes can&apos;t be sent.</p>
        <p className="text-pretty leading-relaxed">
          Email delivery isn&apos;t set up on this server, so no code will reach the mailbox. Until
          it is, a backup code is the only way to sign in. Generate a set below and save it before
          you sign out.
        </p>
      </div>
    </div>
  );
}

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Password, then the new codes, shown once. While they are on screen and not marked as saved, every
 * way of closing asks first: the previous set has already stopped working by then.
 */
function GenerateBackupCodesDialog({ open, onOpenChange }: DialogProps) {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const guard = useUnsavedCodesGuard(open && codes !== null && !saved);

  // Every opening starts over; the codes never outlive the dialog.
  useEffect(() => {
    if (open) return;
    setCodes(null);
    setSaved(false);
  }, [open]);

  async function confirmPassword(password: string) {
    const { data, error } = await runAuthRequest(() => twoFactor.generateBackupCodes({ password }));
    if (error) return authErrorMessage(error, "Couldn't generate backup codes. Please try again.");
    setCodes(data.backupCodes);
    toast.success('Backup codes generated. Any earlier ones no longer work.');
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={codes ? 'Save your backup codes' : 'Generate backup codes?'}
      description={
        codes
          ? "They won't be shown again. Each one signs you in once."
          : 'Any backup codes you already have stop working as soon as the new ones are made.'
      }
      icon={KeyRound}
      size="sm"
      beforeClose={guard.beforeClose}
    >
      {open && !codes && (
        <PasswordConfirmForm
          id="generate-backup-codes-password"
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
              consequence="Any earlier codes already stopped working; you can generate another set."
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
