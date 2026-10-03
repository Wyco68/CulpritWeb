'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Copy, Download, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/modules/shared/ui/button';
import { DialogFooter } from '@/modules/shared/ui/dialog';

// The one time the backup codes are visible (ADR-022: stored encrypted, never shown again). Copy
// and download are both offered because the admin's safe place may be a password manager or a
// file; the "I've saved these" box is the caller's gate on leaving this step.

const FILE_NAME = 'the-culprit-backup-codes.txt';

export function backupCodesFileText(codes: readonly string[], generatedAt: Date): string {
  return [
    'The Culprit — admin backup codes',
    `Generated ${generatedAt.toISOString().slice(0, 10)}`,
    'Each code signs in once, in place of the emailed code. Generating new codes voids these.',
    '',
    ...codes,
    '',
  ].join('\n');
}

export function BackupCodesPanel({
  codes,
  saved,
  onSavedChange,
  focusOnMount = false,
}: {
  codes: readonly string[];
  saved: boolean;
  onSavedChange: (saved: boolean) => void;
  /** Move focus to the codes when they appear, so a screen reader reads them out first. */
  focusOnMount?: boolean;
}) {
  const headingId = useId();
  const checkboxId = useId();
  const listRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!focusOnMount) return;
    const frame = requestAnimationFrame(() => listRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [focusOnMount]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      toast.success('Backup codes copied.');
    } catch {
      toast.error("Couldn't copy. Select the codes and copy them instead.");
    }
  }

  function download() {
    const blob = new Blob([backupCodesFileText(codes, new Date())], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = FILE_NAME;
    // In the document for the click (Firefox ignores a detached anchor), and the URL revoked a task
    // later: revoking it synchronously can cancel the download in Safari and older Firefox.
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <div className="flex flex-col gap-5">
      <section
        ref={listRef}
        tabIndex={-1}
        aria-labelledby={headingId}
        className="focus-ring rounded-lg border border-border-strong bg-muted/50 p-4"
      >
        <h3 id={headingId} className="sr-only">
          Your backup codes
        </h3>
        <ol className="grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-sm tracking-wider text-foreground">
          {codes.map((code) => (
            <li key={code} className="select-all">
              {code}
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          <Copy className="size-3.5" aria-hidden="true" />
          Copy codes
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={download}>
          <Download className="size-3.5" aria-hidden="true" />
          Download .txt
        </Button>
      </div>

      <div className="flex items-start gap-3">
        <input
          id={checkboxId}
          type="checkbox"
          checked={saved}
          onChange={(event) => onSavedChange(event.target.checked)}
          className="focus-ring mt-0.5 size-4 shrink-0 accent-accent"
        />
        <label htmlFor={checkboxId} className="text-sm text-foreground">
          I&apos;ve saved these codes somewhere safe. They won&apos;t be shown again.
        </label>
      </div>
    </div>
  );
}

/**
 * Keeps a dialog that is showing backup codes from closing silently before they are saved: they
 * are never shown again. Pass `beforeClose` to the Dialog (Escape, backdrop, close button) and run
 * the dialog's own Cancel through it too; while `confirming`, render `UnsavedCodesFooter`.
 */
export function useUnsavedCodesGuard(active: boolean) {
  const [confirming, setConfirming] = useState(false);

  // Ticking "I've saved these" (or leaving the codes step) clears a pending question.
  useEffect(() => {
    if (!active) setConfirming(false);
  }, [active]);

  const beforeClose = useCallback(() => {
    if (!active) return true;
    setConfirming(true);
    return false;
  }, [active]);

  const keep = useCallback(() => setConfirming(false), []);

  return { confirming, beforeClose, keep };
}

/** "Close without saving these codes?" — asked in place of the dialog's footer. */
export function UnsavedCodesFooter({
  consequence,
  onKeep,
  onCloseAnyway,
}: {
  /** What closing now costs, e.g. "Your old codes already stopped working." */
  consequence: string;
  onKeep: () => void;
  onCloseAnyway: () => void;
}) {
  const keepRef = useRef<HTMLButtonElement>(null);
  // The safe answer takes focus, so Enter or Space right after Escape doesn't lose the codes.
  useEffect(() => keepRef.current?.focus(), []);

  return (
    <DialogFooter className="flex-wrap bg-warning-tint">
      <p role="alert" className="mr-auto flex basis-full items-start gap-2 text-sm text-foreground">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <span>
          <span className="font-medium">Close without saving these codes?</span> They won&apos;t be
          shown again. {consequence}
        </span>
      </p>
      <Button ref={keepRef} type="button" variant="outline" onClick={onKeep}>
        Keep them open
      </Button>
      <Button type="button" variant="destructive" onClick={onCloseAnyway}>
        Close anyway
      </Button>
    </DialogFooter>
  );
}
