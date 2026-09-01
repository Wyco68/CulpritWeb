'use client';

import * as React from 'react';
import { cn } from '@/modules/shared/lib/utils';

// Accessible on/off toggle built on a real checkbox (role="switch" per WAI-ARIA switch pattern),
// visually hidden but still keyboard/AT operable — avoids a Radix Switch dependency while keeping
// full native semantics (Space to toggle, `aria-checked` reflects state automatically).
export interface SwitchProps {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-describedby'?: string;
  'aria-label'?: string;
  className?: string;
}

export function Switch({
  id,
  checked,
  onCheckedChange,
  disabled,
  className,
  ...aria
}: SwitchProps) {
  return (
    <label
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-border transition-colors',
        checked ? 'bg-accent' : 'bg-muted',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="peer absolute inset-0 size-full cursor-pointer appearance-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.target.checked)}
        {...aria}
      />
      <span
        aria-hidden="true"
        className={cn(
          // `transition-[translate]`, not `transition-transform`: Tailwind v4 compiles
          // `translate-x-*` to the standalone `translate` property, so `transition-transform`
          // matched nothing and the thumb snapped between positions instead of sliding.
          'pointer-events-none inline-block size-4.5 translate-x-1 rounded-full bg-background shadow transition-[translate]',
          checked && 'translate-x-[22px]',
        )}
      />
    </label>
  );
}
