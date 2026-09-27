'use client';

import { cn } from '@/modules/shared/lib/utils';

// An on/off switch: a native <button> with `role="switch"`, so it is focusable, toggles with Space
// and Enter, and is announced as "switch, on/off" with its visible label as its name.

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'group flex w-full items-center justify-between gap-4 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus-ring disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
        )}
      </span>
      {/* The track and thumb are decoration; state reaches assistive tech through aria-checked. */}
      <span
        aria-hidden="true"
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors',
          checked ? 'border-accent bg-accent' : 'border-border-strong bg-muted',
        )}
      >
        <span
          className={cn(
            'absolute size-3.5 rounded-full bg-surface shadow-sm transition-[left] duration-200',
            checked ? 'left-[1.1rem]' : 'left-0.5',
          )}
        />
      </span>
    </button>
  );
}
