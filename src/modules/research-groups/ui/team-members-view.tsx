'use client';

import { useId, useState } from 'react';
import { Avatar } from '@/modules/shared/ui/avatar';
import { cn } from '@/modules/shared/lib/utils';
// Deep imports, not the barrel — the barrel re-exports Prisma-backed service getters; even a
// type-only barrel import drags Prisma/`pg` into the client bundle (confirmed empirically).
import type { ResearchGroup } from '../research-group.types';
import type { TeamMember } from '../team-member.types';

// Public surfacing of research groups (spec FR-4) — no separate "Research Groups" tab; grouped
// team members ARE that tab. `groups[].teamMembers` already carries the grouped members;
// `ungrouped` (researchGroupId === null, not present in any group) renders last under "Other"
// with no header when empty.

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
      <div className="min-w-0">
        <p className="font-serif text-lg leading-tight text-foreground">{member.name}</p>
        <p className="mt-1 text-sm text-accent">{member.role}</p>
        {bio && (
          <>
            <p id={bioId} className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
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
  heading,
  description,
  members,
}: {
  heading?: string;
  description?: string;
  members: TeamMember[];
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={heading ? headingId : undefined} className="space-y-5">
      {heading && (
        <div>
          <h3 id={headingId} className="text-balance font-serif text-2xl text-foreground">
            {heading}
          </h3>
          {description && (
            <p className="mt-2 max-w-[62ch] text-pretty leading-relaxed text-muted-foreground">
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

export function TeamMembersView({
  groups,
  ungrouped,
}: {
  groups: ResearchGroup[];
  ungrouped: TeamMember[];
}) {
  return (
    <div className="space-y-16">
      {groups
        .filter((group) => group.teamMembers.length > 0)
        .map((group) => (
          <GroupSection
            key={group.id}
            heading={group.name}
            description={group.description}
            members={group.teamMembers}
          />
        ))}

      {ungrouped.length > 0 && (
        <GroupSection heading={groups.length > 0 ? 'Other' : undefined} members={ungrouped} />
      )}
    </div>
  );
}
