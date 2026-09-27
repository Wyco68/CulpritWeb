import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Avatar } from '@/modules/shared/ui/avatar';
import { panelClassName } from '@/modules/shared/ui/card';
import { cn } from '@/modules/shared/lib/utils';
// Deep import, not the barrel — the barrel re-exports Prisma-backed service getters.
import type { TeamMember } from '../team-member.types';
import { groupMembers } from '../team-grouping';

// The public Team tab (ADR-020): the director featured on their own across the full width, then
// one grid of people per admin-defined team in the admin's order, then anyone on no team. Every
// card links to that member's profile page.
//
// The teams are real `<section>`s with real headings rather than one list with visual dividers:
// "which team is this person on" is the structure of the page, so it has to survive being read by
// heading or by region, not only by looking at the gaps. Each grid is `aria-labelledby` its own
// heading, so a screen reader announces "Research Team, list, 4 items".
//
// The director's card is set apart by its surface, its "Lab Director" eyebrow and its larger name,
// never by a different portrait: the photo is the same plain square every member has.

export function memberInitials(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'
  );
}

export function TeamMemberCard({
  member,
  className,
  style,
}: {
  member: TeamMember;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Link
      href={`/team/${member.id}`}
      style={style}
      className={cn(
        'group flex h-full items-center gap-4 transition-[border-color,translate,scale] duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] active:duration-150 hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        panelClassName,
        className,
      )}
    >
      <Avatar
        src={member.photoUrl}
        alt={`Portrait of ${member.name}`}
        fallback={memberInitials(member.name)}
        size="md"
      />
      {/* `min-w-0` + `break-words` so a long unhyphenated name or role wraps inside the card. */}
      <div className="min-w-0 flex-1">
        <p className="break-words font-serif text-lg leading-tight text-foreground group-hover:underline group-hover:underline-offset-4">
          {member.name}
        </p>
        <p className="mt-1 break-words text-sm text-muted-foreground">{member.role}</p>
      </div>
      <ArrowRight
        className="size-4 shrink-0 text-muted-foreground transition-[translate] duration-500 ease-[var(--ease-out-expo)] group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

/** The director, across the full width: a tinted panel, the title, and the start of their bio. */
export function DirectorCard({ member }: { member: TeamMember }) {
  return (
    <Link
      href={`/team/${member.id}`}
      className={cn(
        'group flex items-center gap-5 transition-[border-color,translate,scale] duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] active:duration-150 hover:border-accent/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        panelClassName,
        // The masthead green wash the dialogs use for their headers, so the card reads as the head
        // of the page rather than as one more member.
        'border-accent/30 bg-[color-mix(in_srgb,var(--masthead)_45%,var(--surface))]',
      )}
    >
      <Avatar
        src={member.photoUrl}
        alt={`Portrait of ${member.name}`}
        fallback={memberInitials(member.name)}
        size="md"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
          Lab Director
        </p>
        <p className="mt-1.5 break-words font-serif text-2xl leading-tight text-foreground group-hover:underline group-hover:underline-offset-4">
          {member.name}
        </p>
        <p className="mt-1 break-words text-sm text-muted-foreground">
          {[member.role, member.affiliation].filter(Boolean).join(' · ')}
        </p>
        {member.bio && (
          <p className="mt-3 line-clamp-2 max-w-[70ch] text-pretty text-sm leading-relaxed text-muted-foreground max-sm:hidden">
            {member.bio}
          </p>
        )}
      </div>
      <ArrowRight
        className="size-4 shrink-0 text-muted-foreground transition-[translate] duration-500 ease-[var(--ease-out-expo)] group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

export function TeamMembersView({ members }: { members: TeamMember[] }) {
  const { director, groups } = groupMembers(members);
  // The `rise` stagger runs down the whole page rather than restarting per team, so the cards
  // settle in reading order instead of columns animating in parallel.
  let cardIndex = 0;

  return (
    <div className="space-y-10">
      {director && (
        <section aria-label="Lab director">
          <div style={{ '--i': cardIndex++ } as React.CSSProperties} className="rise">
            <DirectorCard member={director} />
          </div>
        </section>
      )}

      {groups.map((group) => {
        const headingId = `team-${group.team?.id ?? 'members'}`;

        return (
          <section
            key={group.team?.id ?? 'members'}
            aria-labelledby={headingId}
            className="border-t border-border pt-8 first:border-t-0 first:pt-0"
          >
            <h3 id={headingId} className="font-serif text-xl font-semibold text-accent">
              {/* Only reached when some members have no team; when nobody has one it is simply
                  the list of everyone. */}
              {group.team?.name ?? (groups.length > 1 ? 'Other members' : 'Members')}
            </h3>

            <ul aria-labelledby={headingId} className="mt-5 grid gap-5 sm:grid-cols-2">
              {group.members.map((member) => (
                <li
                  key={member.id}
                  style={{ '--i': cardIndex++ } as React.CSSProperties}
                  className="rise"
                >
                  <TeamMemberCard member={member} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
