'use client';

import { useId, useState } from 'react';
import { Avatar } from '@/modules/shared/ui/avatar';
import { SectionNav, type SectionNavItem } from '@/modules/shared/ui/section-nav';
import { cn } from '@/modules/shared/lib/utils';
// Deep imports, not the barrel — the barrel re-exports Prisma-backed service getters; even a
// type-only barrel import drags Prisma/`pg` into the client bundle (confirmed empirically).
import type { ResearchGroup } from '../research-group.types';
import type { TeamMember } from '../team-member.types';

// Public surfacing of research groups (spec FR-4) — no separate "Research Groups" tab; grouped
// team members ARE that tab. `groups[].teamMembers` already carries the grouped members;
// `ungrouped` (researchGroupId === null, not present in any group) renders last under "Other"
// with no header when empty.

// The anchor a group is reachable at — /team#systems-security-lab. Derived from the group's name
// rather than its id: the id is a cuid, and a hash is a thing people are given, read out and paste
// into a message. Names are admin-entered free text, so the result is deduplicated by the caller
// below; a group whose name slugs to nothing (all punctuation) falls back to its index.
function toSectionId(name: string, index: number): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug ? `group-${slug}` : `group-${index + 1}`;
}

function MemberCard({ member }: { member: TeamMember }) {
  const bioId = useId();
  const [expanded, setExpanded] = useState(false);
  const bio = member.bio ?? '';
  const isLong = bio.length > 180;
  const shown = expanded || !isLong ? bio : `${bio.slice(0, 180).trimEnd()}…`;

  return (
    // Borderless, rule-separated roster entry. Boxing each person in a bordered card produced a
    // grid of near-identical rectangles — the most template-looking pattern available — and the
    // borders carried no information the whitespace and rules don't already carry.
    <li className="flex gap-4 border-t border-border py-6">
      <Avatar
        src={member.photoUrl}
        alt={`Portrait of ${member.name}`}
        fallback={member.name.slice(0, 1).toUpperCase()}
        size="md"
      />
      {/* `min-w-0` so the text column can shrink below its longest word inside the flex row, and
          `break-words` so that word then breaks instead of running under the next column. A name
          or role can be a long unhyphenated string ("Wissenschaftlicher Mitarbeiter"). */}
      <div className="min-w-0">
        <p className="break-words font-serif text-lg leading-tight text-foreground">
          {member.name}
        </p>
        <p className="mt-1 break-words text-sm text-accent">{member.role}</p>
        {bio && (
          <>
            <p
              id={bioId}
              className="mt-2 text-pretty break-words text-sm leading-relaxed text-muted-foreground"
            >
              {shown}
            </p>
            {isLong && (
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={bioId}
                onClick={() => setExpanded((value) => !value)}
                className="mt-1.5 rounded-xs text-sm font-medium text-accent underline-offset-4 transition-colors duration-300 ease-[var(--ease-out-expo)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function GroupSection({
  id,
  heading,
  description,
  members,
}: {
  id?: string;
  heading?: string;
  description?: string;
  members: TeamMember[];
}) {
  const headingId = useId();
  return (
    <section id={id} aria-labelledby={heading ? headingId : undefined} className="space-y-5">
      {heading && (
        <div>
          <h3 id={headingId} className="text-balance break-words font-serif text-2xl text-foreground">
            {heading}
          </h3>
          {description && (
            <p className="mt-2 max-w-[62ch] text-pretty break-words leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      )}
      {/* Two columns of rule-separated entries, not two columns of cards. `gap-x` only: the rows
          are divided by their own top borders, so a vertical gap would break the rule line. */}
      <ul className={cn('grid gap-x-10 sm:grid-cols-2')}>
        {members.map((member) => (
          <MemberCard key={member.id} member={member} />
        ))}
      </ul>
    </section>
  );
}

const UNGROUPED_ID = 'group-other';

export function TeamMembersView({
  groups,
  ungrouped,
}: {
  groups: ResearchGroup[];
  ungrouped: TeamMember[];
}) {
  const populated = groups.filter((group) => group.teamMembers.length > 0);

  // Ids are assigned once, here, and used for both the jump list and the sections it points at —
  // one derivation, so a nav entry can never point at an anchor that does not exist. Two groups
  // sharing a name would otherwise share an id and make the second unreachable, so a collision
  // takes a numeric suffix; the first occurrence keeps the clean URL.
  const seen = new Map<string, number>();
  const sections = populated.map((group, index) => {
    const base = toSectionId(group.name, index);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return { group, id: count === 0 ? base : `${base}-${count + 1}` };
  });

  const navItems: SectionNavItem[] = [
    ...sections.map(({ group, id }) => ({ id, label: group.name })),
    ...(ungrouped.length > 0 && populated.length > 0
      ? [{ id: UNGROUPED_ID, label: 'Other' }]
      : []),
  ];

  return (
    <div className="space-y-16">
      {/* Named "Research groups" rather than the default "On this page": this strip is the group
          index, and the name is what a screen-reader user hears when they land on the landmark. */}
      <SectionNav items={navItems} label="Research groups" />

      {sections.map(({ group, id }) => (
        <GroupSection
          key={group.id}
          id={id}
          heading={group.name}
          description={group.description}
          members={group.teamMembers}
        />
      ))}

      {ungrouped.length > 0 && (
        <GroupSection
          id={populated.length > 0 ? UNGROUPED_ID : undefined}
          heading={populated.length > 0 ? 'Other' : undefined}
          members={ungrouped}
        />
      )}
    </div>
  );
}
