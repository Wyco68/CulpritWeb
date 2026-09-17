import { ArrowUpRight } from 'lucide-react';
import { BylineNames, type BylineMember } from '@/modules/research-groups';
import type { Research } from '@/modules/research';

// Grouped by area. Every well-structured faculty and lab site organises research thematically
// rather than as one undifferentiated list — the area is what a visitor is actually scanning for
// ("does this group work on access control?"), and repeating it as a per-row label made it a
// property of each item instead of the structure of the page.
//
// Areas keep the admin's own ordering: the service returns rows by `sortOrder`, so the first time
// an area appears fixes its position. Ordering areas alphabetically would silently override the
// sequence the admin arranged.

function groupByArea(items: Research[]): { area: string; items: Research[] }[] {
  const groups = new Map<string, Research[]>();
  for (const item of items) {
    const existing = groups.get(item.area);
    if (existing) existing.push(item);
    else groups.set(item.area, [item]);
  }
  return [...groups].map(([area, grouped]) => ({ area, items: grouped }));
}

export function ResearchList({
  items,
  members = [],
}: {
  items: Research[];
  /** Lab members, see the note in publications-list.tsx. */
  members?: readonly BylineMember[];
}) {
  const groups = groupByArea(items);

  return (
    <div className="space-y-10">
      {groups.map((group, groupIndex) => (
        <section
          key={group.area}
          aria-labelledby={`research-${groupIndex}`}
          style={{ '--i': groupIndex } as React.CSSProperties}
          className="rise"
        >
          <h3
            id={`research-${groupIndex}`}
            className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-accent"
          >
            {group.area}
          </h3>

          <ul className="grid gap-4">
            {group.items.map((item) => (
              <li
                key={item.id}
                className="group min-w-0 rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-7"
              >
                <h4 className="text-balance break-words text-xl font-bold leading-snug tracking-[-0.01em] text-foreground">
                  {item.title}
                </h4>
                <p className="mt-2 max-w-[62ch] text-pretty break-words leading-[1.7] text-muted-foreground">
                  {item.summary}
                </p>
                {/* Omitted entirely when nobody is credited — that means it is his own work. */}
                {item.contributors.length > 0 && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    With{' '}
                    <BylineNames
                      names={item.contributors.map((contributor) => contributor.name)}
                      members={members}
                    />
                  </p>
                )}

                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-masthead px-3 py-1.5 text-sm font-medium text-accent-on-band transition-[background-color,color,scale] duration-200 ease-[var(--ease-out-expo)] hover:bg-accent hover:text-accent-foreground active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    View Project
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
