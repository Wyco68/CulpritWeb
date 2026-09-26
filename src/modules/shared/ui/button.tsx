import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/modules/shared/lib/utils';

// shadcn/ui `new-york` Button, owned by the repo. No Radix Slot dependency is installed, so
// `asChild` isn't supported — every call site renders a real <button> (or pass `type="button"`
// explicitly for non-submit uses). Adds a `loading` prop (spinner + aria-busy) since every admin
// mutation needs an in-flight state.

// Motion notes: a weighted `--ease-out-expo` curve rather than the browser default, and an
// `active:scale` that gives the control a physical press. Compositor-only properties, and both
// collapse to ~0ms under `prefers-reduced-motion` via the global rule in globals.css.
//
// The transition list names `scale`, not `transform`: Tailwind v4 compiles `scale-*` to the
// standalone `scale` property (verified in the built stylesheet — `.active\:scale-\[0\.98\]`
// emits `scale: 0.98`), so a `transform` entry would match nothing and the press would snap.
export const buttonVariants = cva(
  'focus-ring inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium tracking-tight transition-[background-color,border-color,color,scale] duration-300 ease-[var(--ease-out-expo)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // A faint top highlight gives the solid button an engraved, pressed-metal edge.
        default:
          'bg-accent text-accent-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.16)] hover:bg-accent/90',
        // Border at --input-border (3.4:1 on white), so an outline button reads as a control as
        // clearly as a text field does. It used to sit at 1.2:1.
        outline: 'border border-input-border bg-surface text-foreground hover:bg-muted',
        secondary: 'bg-muted text-foreground hover:bg-muted/70',
        ghost: 'text-foreground hover:bg-muted',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link: 'text-accent underline-offset-4 hover:underline active:scale-100',
        // Quiet secondary for the masthead band (Log out). The band's primary action uses the
        // ordinary solid button.
        onBand: 'text-masthead-foreground hover:bg-masthead-foreground/10',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-sm px-3 text-xs',
        lg: 'h-11 rounded-sm px-6',
        icon: 'size-10 shrink-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  loading = false,
  disabled,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
