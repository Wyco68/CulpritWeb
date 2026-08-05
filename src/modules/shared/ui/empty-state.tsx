import type { LucideIcon } from 'lucide-react';
import { cn } from '@/modules/shared/lib/utils';

// Reusable "nothing here yet" / disabled-state panel — used for empty lists (no research yet, no
// publications yet) and admin-gated content (Upcoming Events hidden).

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-16 text-center',
        className,
      )}
    >
      <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-base font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
