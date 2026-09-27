import type { BylineMember } from '@/modules/research-groups';
import type { Research } from '@/modules/research';
import { SectionHeading } from '@/modules/shared/ui/prose';
import { ResearchCards } from './research-cards';

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
  // Only the fields a byline match needs cross into the client cards — the page passes whole member
  // rows, and everything else on them would otherwise be serialised into the page payload.
  const bylineMembers = members.map(({ id, name, citationName }) => ({ id, name, citationName }));

  return (
    <div className="space-y-10">
      {groups.map((group, groupIndex) => (
        <section
          key={group.area}
          aria-labelledby={`research-${groupIndex}`}
          style={{ '--i': groupIndex } as React.CSSProperties}
          className="rise"
        >
          <SectionHeading id={`research-${groupIndex}`} className="mb-5">
            {group.area}
          </SectionHeading>

          <ResearchCards items={group.items} members={bylineMembers} />
        </section>
      ))}
    </div>
  );
}
