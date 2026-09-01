import { cn } from '@/modules/shared/lib/utils';

// Generic content placeholder for route-level `loading.tsx` boundaries. The masthead header/tab bar
// lives in the layout and stays mounted across tab switches, so a skeleton only ever stands in
// for the `<main>` content — a heading bar plus a few text rows, matching the shape every tab
// renders. Purely decorative: the bars are hidden from assistive tech and a single polite status
// message announces the pending navigation instead of a dozen meaningless regions.
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-muted', className)} aria-hidden="true" />;
}

export function PageSkeleton({ label, rows = 4 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-7 w-48 sm:h-8 sm:w-64" />
      <div className="mt-8 space-y-4">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className={cn('h-4', i % 3 === 2 ? 'w-2/3' : 'w-full max-w-2xl')} />
        ))}
      </div>
    </div>
  );
}
