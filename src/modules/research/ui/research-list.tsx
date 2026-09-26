import Image from 'next/image';
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

          {/* Three cards to a row when the content column is wide, two when it is medium, one on a
              phone — sized by the column (`main` is a container), not the viewport. Each card
              stretches to the tallest in its row, and the project link is pinned to the foot so
              the links line up across the row. */}
          <ul className="grid gap-5 @xl:grid-cols-2 @4xl:grid-cols-3">
            {group.items.map((item) => (
              <li
                key={item.id}
                className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border-strong bg-surface shadow-hairline"
              >
                <ResearchPhoto src={item.photoUrl} />

                <div className="flex flex-1 flex-col p-6">
                  <h4 className="text-balance break-words font-serif text-xl leading-snug text-foreground">
                    {item.title}
                  </h4>
                  <p className="mt-2 text-pretty break-words leading-[1.7] text-muted-foreground">
                    {item.summary}
                  </p>
                  {/* Omitted entirely when nobody is credited — that means it is the lab's own work. */}
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
                    <div className="mt-auto pt-5">
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border bg-masthead px-3 py-1.5 text-sm font-medium text-accent-on-band transition-[background-color,color,scale] duration-200 ease-[var(--ease-out-expo)] hover:bg-accent hover:text-accent-foreground active:scale-[0.97]"
                      >
                        <ArrowUpRight className="size-3.5" aria-hidden="true" />
                        View Project
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * The card's 3:2 photo, uploaded by the admin. The title right beneath it names the work, so the
 * image is decorative to assistive tech (`alt=""`). Without a photo the frame shows engraved rings
 * on the masthead green — the site's own ornament, drawn by one CSS gradient rather than a
 * per-card SVG.
 */
function ResearchPhoto({ src }: { src: string | null }) {
  return (
    <div className="relative aspect-[3/2] overflow-hidden border-b border-border bg-masthead">
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes="(min-width: 1280px) 340px, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_72%_38%,transparent_0_7px,color-mix(in_srgb,var(--engraving)_28%,transparent)_7px_8px)]"
        />
      )}
    </div>
  );
}
