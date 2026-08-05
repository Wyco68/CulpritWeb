import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/modules/shared/lib/utils';

// shadcn/ui `new-york` Button, owned by the repo. No Radix Slot dependency is installed, so
// `asChild` isn't supported — every call site renders a real <button> (or pass `type="button"`
// explicitly for non-submit uses). Adds a `loading` prop (spinner + aria-busy) since every admin
// mutation needs an in-flight state.

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium tracking-tight transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
  {
    variants: {
      variant: {
        default: 'bg-accent text-accent-foreground hover:bg-accent/90',
        outline: 'border border-border bg-background text-foreground hover:bg-muted',
        secondary: 'bg-muted text-foreground hover:bg-muted/70',
        ghost: 'text-foreground hover:bg-muted',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link: 'text-accent underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-6',
        icon: 'size-9 shrink-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ComponentProps<'button'>,
    VariantProps<typeof buttonVariants> {
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
