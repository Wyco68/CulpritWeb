'use client';

import { useId, useState } from 'react';
import { Plus, Search, type LucideIcon } from 'lucide-react';
import { INSTITUTION_TIME_ZONE } from '@/modules/shared/lib/timezone';
import { Button } from './button';
import { EmptyState } from './empty-state';
import { Skeleton } from './page-skeleton';
import { RowActionsMenu, type RowAction } from './row-actions-menu';
import { StatusPill, type Status } from './status-pill';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

// The shape every admin list shares: search first, then five columns — the record itself, its
// derived status, when it last changed, the group it belongs to, and one actions menu. One
// component so the seven admin lists read as one product instead of seven hand-rolled tables.
//
// Filtering is client-side over the rows the page already loaded: these lists are tens of rows,
// and a round trip per keystroke would be slower than the filter it replaces.

/** Absolute, in the institution's zone: a relative "3 days ago" would differ between the server
 *  render and hydration, and an admin reading an audit question wants the date. */
const updatedFormatter = new Intl.DateTimeFormat('en', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: INSTITUTION_TIME_ZONE,
});

export interface RecordTableProps<T extends { id: string; updatedAt: Date }> {
  items: readonly T[];
  /** Plural noun for the search label and the no-match message, e.g. "team members". */
  noun: string;
  /** The text a search matches against — the fields an admin would type to find a row. */
  searchText: (item: T) => string;
  identityHeader: string;
  identity: (item: T) => React.ReactNode;
  statusHeader: string;
  status: (item: T) => Status;
  groupHeader: string;
  group: (item: T) => React.ReactNode;
  /** Names the record in the actions button, e.g. "Actions: Jane Jaimunk". */
  rowLabel: (item: T) => string;
  actions: (item: T) => RowAction[];
  empty: {
    icon: LucideIcon;
    title: string;
    description: string;
    /** Omitted when the list can't be added to (a retired CV list). */
    action?: { label: string; onClick: () => void };
  };
}

export function RecordTable<T extends { id: string; updatedAt: Date }>({
  items,
  noun,
  searchText,
  identityHeader,
  identity,
  statusHeader,
  status,
  groupHeader,
  group,
  rowLabel,
  actions,
  empty,
}: RecordTableProps<T>) {
  const [query, setQuery] = useState('');
  const searchId = useId();

  if (items.length === 0) {
    return (
      <EmptyState
        icon={empty.icon}
        title={empty.title}
        description={empty.description}
        action={
          empty.action && (
            <Button onClick={empty.action.onClick}>
              <Plus className="size-4" aria-hidden="true" />
              {empty.action.label}
            </Button>
          )
        }
      />
    );
  }

  const needle = query.trim().toLowerCase();
  const rows = needle
    ? items.filter((item) => searchText(item).toLowerCase().includes(needle))
    : items;

  // A fragment, not a wrapper: `FormSection` bleeds a table that is its direct child to the panel
  // edges, and the search bar above it keeps the panel's padding.
  return (
    <>
      <div className="relative">
        <label htmlFor={searchId} className="sr-only">
          Search {noun}
        </label>
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${noun}…`}
          autoComplete="off"
          spellCheck={false}
          className="h-11 w-full rounded-md border border-input-border bg-input pl-10 pr-3 text-sm text-foreground transition-[background-color,border-color,box-shadow] duration-200 ease-[var(--ease-out-expo)] placeholder:text-muted-foreground outline-none focus-visible:border-accent focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </div>

      {/* Announces the result count as the admin types, so a screen-reader user knows the filter
          did something without re-reading the table. */}
      <p aria-live="polite" className="sr-only">
        {needle ? `${rows.length} of ${items.length} ${noun} shown` : ''}
      </p>

      {rows.length === 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border-strong px-5 py-6 text-sm text-muted-foreground">
          <span>
            No {noun} match “<span className="text-foreground">{query.trim()}</span>”.
          </span>
          <Button variant="outline" size="sm" onClick={() => setQuery('')}>
            Clear search
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{identityHeader}</TableHead>
              <TableHead>{statusHeader}</TableHead>
              <TableHead>Last updated</TableHead>
              <TableHead>{groupHeader}</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="min-w-0 font-medium text-foreground">
                  {identity(item)}
                </TableCell>
                <TableCell>
                  <StatusPill status={status(item)} />
                </TableCell>
                <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                  <time dateTime={item.updatedAt.toISOString()}>
                    {updatedFormatter.format(item.updatedAt)}
                  </time>
                </TableCell>
                <TableCell className="min-w-0 text-muted-foreground">{group(item)}</TableCell>
                <TableCell className="w-12 text-right">
                  <RowActionsMenu label={rowLabel(item)} actions={actions(item)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

/** Two-line identity cell: the record's name, then one quiet line of context. */
export function RecordIdentity({
  title,
  detail,
  leading,
}: {
  title: React.ReactNode;
  detail?: React.ReactNode;
  leading?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {leading}
      <div className="min-w-0">
        <span className="line-clamp-2 block max-w-[46ch] break-words">{title}</span>
        {detail && (
          <span className="mt-0.5 line-clamp-1 block max-w-[46ch] break-words text-xs font-normal text-muted-foreground">
            {detail}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The loading stand-in for a `RecordTable` inside its panel: the same search bar, header row and
 * five rows with each cell's shape (avatar + two lines, pill, date, group, menu button), so the
 * real table lands without the layout jumping.
 */
export function RecordTableSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-11 w-full rounded-md" />
      <div className="overflow-hidden rounded-lg border border-border-strong">
        <div className="grid grid-cols-[minmax(0,2.4fr)_1fr_1fr_1fr_3rem] gap-4 border-b border-border bg-muted/50 px-4 py-3">
          {['w-2/5', 'w-1/2', 'w-3/5', 'w-1/2'].map((width, index) => (
            <Skeleton key={index} className={`h-3 ${width}`} />
          ))}
        </div>
        {Array.from({ length: 5 }, (_, row) => (
          <div
            key={row}
            className="grid grid-cols-[minmax(0,2.4fr)_1fr_1fr_1fr_3rem] items-center gap-4 border-b border-border px-4 py-3.5 last:border-0"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="w-full space-y-1.5">
                <Skeleton className={row % 2 ? 'h-3.5 w-3/5' : 'h-3.5 w-4/5'} />
                <Skeleton className="h-3 w-2/5" />
              </div>
            </div>
            <Skeleton className="h-5 w-20 rounded-pill" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="ml-auto size-8 rounded-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}
