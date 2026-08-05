'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('team');
  const bioId = useId();
  const [expanded, setExpanded] = useState(false);
  const bio = member.bio ?? '';
  const isLong = bio.length > 180;
  const shown = expanded || !isLong ? bio : `${bio.slice(0, 180).trimEnd()}…`;

  return (
    <li className="flex gap-4 rounded-lg border border-border p-4">
      <Avatar
        src={member.photoUrl}
        alt={t('photoAlt', { name: member.name })}
        fallback={member.name.slice(0, 1).toUpperCase()}
        size="sm"
      />
      <div className="min-w-0">
        <p className="font-medium text-foreground">{member.name}</p>
        <p className="text-sm text-accent">{member.role}</p>
        {bio && (
          <>
            <p id={bioId} className="mt-1.5 text-sm text-muted-foreground">
              {shown}
            </p>
            {isLong && (
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={bioId}
                onClick={() => setExpanded((value) => !value)}
                className="mt-1 rounded text-sm font-medium text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {expanded ? t('showLess') : t('showMore')}
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
    <section aria-labelledby={heading ? headingId : undefined} className="space-y-4">
      {heading && (
        <div>
          <h3 id={headingId} className="text-lg font-semibold tracking-tight text-foreground">
            {heading}
          </h3>
          {description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      <ul className={cn('grid gap-3 sm:grid-cols-2')}>
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
  const t = useTranslations('team');

  return (
    <div className="space-y-12">
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
        <GroupSection heading={groups.length > 0 ? t('other') : undefined} members={ungrouped} />
      )}
    </div>
  );
}
