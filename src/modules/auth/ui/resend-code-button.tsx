import { RotateCw } from 'lucide-react';
import { Button } from '@/modules/shared/ui/button';

// "Resend code", shared by the sign-in and password-reset flows. Disabled while the
// cooldown runs; the seconds left are shown but hidden from assistive technology, so a screen
// reader isn't read a new label every second while the button has focus.
export function ResendCodeButton({
  onResend,
  remaining,
  loading,
  disabled,
}: {
  onResend: () => void;
  remaining: number;
  loading: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onResend}
      loading={loading}
      disabled={disabled || remaining > 0}
    >
      {!loading && <RotateCw className="size-3.5" aria-hidden="true" />}
      Resend code
      {remaining > 0 && (
        <span aria-hidden="true" className="tabular text-muted-foreground">
          in {remaining}s
        </span>
      )}
    </Button>
  );
}
