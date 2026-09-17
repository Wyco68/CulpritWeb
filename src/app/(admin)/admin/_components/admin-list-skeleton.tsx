import { Skeleton } from '@/modules/shared/ui/page-skeleton';
import { RecordTableSkeleton } from '@/modules/shared/ui/record-table';

// Loading state for the admin screens whose main content is one record list. Mirrors
// `AdminScreen` + `FormSection` + `RecordTable`: heading, the panel header with its Add button,
// then the search bar and five table rows, so nothing shifts when the data arrives.
export function AdminListSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-10">
      <span className="sr-only">Loading…</span>
      <div aria-hidden="true" className="space-y-4">
        <Skeleton className="h-8 w-56 sm:h-9" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div
        aria-hidden="true"
        className="overflow-hidden rounded-lg border border-border-strong bg-surface shadow-hairline"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="space-y-2.5">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-3.5 w-72 max-w-full" />
          </div>
          <Skeleton className="h-10 w-20 rounded-sm" />
        </div>
        <div className="px-6 py-6">
          <RecordTableSkeleton />
        </div>
      </div>
    </div>
  );
}
