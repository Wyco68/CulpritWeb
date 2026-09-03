import { cn } from '@/modules/shared/lib/utils';

// Hand-rolled chart marks — no charting library is installed, and these three forms don't warrant
// one. Built in CSS rather than SVG so they stay responsive without a viewBox distorting the
// marks.
//
// Shared rules, applied to every mark here:
//   · One hue for the whole series. Magnitude is carried by length, never by colour — shading each
//     bar darker-where-bigger would double-encode the same value and burn the only free channel.
//   · Columns cap at 24px and never fill their slot; the leftover band is air.
//   · 4px rounded data-end, square at the baseline, so the mark reads as growing from the axis.
//   · A 2px surface gap separates touching marks; no stroke is drawn around a mark.
//   · Axis and value text uses text tokens, never the series colour.
//   · Labels are selective — the extreme is labelled, the rest are carried by the axis and each
//     mark's own tooltip/accessible name.

/** One year's worth of output in the column chart. */
export interface YearDatum {
  year: number;
  count: number;
}

/**
 * Publication output per year. A column chart because the job is change over time on a single
 * series — the same view a reader of an academic profile already knows from Google Scholar.
 *
 * Years with no publications are rendered as empty slots rather than skipped: a gap in output is
 * itself information, and closing it would silently misstate the timeline.
 */
export function YearColumns({ data, className }: { data: YearDatum[]; className?: string }) {
  if (data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.count));
  const peak = data.find((d) => d.count === max);
  const total = data.reduce((sum, d) => sum + d.count, 0);

  // Axis ticks are thinned from the newest year backwards, so the most recent year is always
  // labelled and every kept tick is a fixed stride apart. Thinning by `index % 2` and then forcing
  // the last one back in produced two adjacent labels at the right edge, which collided into
  // "20242025" on a narrow screen.
  const tickStride = Math.ceil(data.length / 6);
  const lastIndex = data.length - 1;

  return (
    <figure className={cn('m-0', className)}>
      <div
        className="flex h-40 items-end gap-0.5"
        role="img"
        aria-label={`Publications per year. ${total} in total across ${data.length} years, peaking at ${max} in ${peak?.year}.`}
      >
        {data.map((d) => (
          <div key={d.year} className="flex h-full flex-1 flex-col justify-end gap-1.5">
            {/* The peak is the only directly-labelled column. A number on every mark is noise —
                the rest are carried by the axis and each column's own tooltip. */}
            {d.count === max && (
              <span className="tabular text-center font-mono text-[10px] leading-none text-muted-foreground">
                {d.count}
              </span>
            )}
            {/* A year with no output keeps its slot and is drawn as a hairline on the baseline,
                so an empty year reads as "nothing published" rather than as missing data. The
                inline height is applied only when there is something to scale — setting it to 0%
                would override the hairline class and render nothing at all. */}
            <div
              title={`${d.year}: ${d.count} ${d.count === 1 ? 'publication' : 'publications'}`}
              style={d.count > 0 ? { height: `${(d.count / max) * 100}%` } : undefined}
              className={cn(
                'mx-auto w-full max-w-6',
                d.count > 0 ? 'rounded-t-xs bg-accent' : 'h-px bg-input-border',
              )}
            />
          </div>
        ))}
      </div>

      {/* Hairline baseline, one step off the surface — recessive, solid, never dashed. */}
      <div className="h-px w-full bg-border" />

      <div className="mt-2 flex gap-0.5">
        {data.map((d, i) => (
          <span
            key={d.year}
            className="tabular min-w-0 flex-1 text-center font-mono text-[10px] text-muted-foreground"
          >
            {(lastIndex - i) % tickStride === 0 ? d.year : '\u00A0'}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** One row of a horizontal distribution. */
export interface DistributionDatum {
  label: string;
  count: number;
}

/**
 * Magnitude across named categories — research areas, group sizes. Horizontal because the category
 * names are long prose labels, which a column chart would either clip or turn on their side.
 *
 * Rows are ordered by size so the shape of the distribution is readable without a scale.
 */
export function DistributionBars({
  data,
  className,
}: {
  data: DistributionDatum[];
  className?: string;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.count));

  return (
    <ul className={cn('flex flex-col gap-3', className)}>
      {[...data]
        .sort((a, b) => b.count - a.count)
        .map((d) => (
          <li key={d.label} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5">
            <span className="truncate text-sm text-foreground" title={d.label}>
              {d.label}
            </span>
            <span className="tabular font-mono text-xs text-muted-foreground">{d.count}</span>
            {/* Track in the muted surface, fill in the one series hue. The value sits in text
                tokens beside the mark, never inside it. */}
            <div className="col-span-2 h-1.5 w-full overflow-hidden rounded-pill bg-muted">
              <div
                style={{ width: max > 0 ? `${(d.count / max) * 100}%` : '0%' }}
                className="h-full rounded-r-xs bg-accent"
              />
            </div>
          </li>
        ))}
    </ul>
  );
}

/**
 * A single ratio against a limit — how much of the structured profile is filled in. A meter, not a
 * chart: there is one number and a ceiling.
 */
export function CompletenessMeter({
  filled,
  total,
  className,
}: {
  filled: number;
  total: number;
  className?: string;
}) {
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="tabular font-serif text-3xl leading-none text-foreground">{pct}%</span>
        <span className="tabular font-mono text-xs text-muted-foreground">
          {filled}/{total}
        </span>
      </div>
      <div
        role="meter"
        aria-valuenow={filled}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`Profile sections filled in: ${filled} of ${total}`}
        className="h-1.5 w-full overflow-hidden rounded-pill bg-muted"
      >
        <div style={{ width: `${pct}%` }} className="h-full rounded-r-xs bg-accent" />
      </div>
    </div>
  );
}
