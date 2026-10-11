// Prefetches on hover/focus rather than on sight — see intent-link.tsx.
import { IntentLink as Link } from '@/modules/shared/ui/intent-link';
import { ArrowRight } from 'lucide-react';
import { Avatar } from '@/modules/shared/ui/avatar';
import { panelClassName } from '@/modules/shared/ui/card';
import { cn } from '@/modules/shared/lib/utils';
// Deep import, not the barrel — the barrel re-exports Prisma-backed service getters.
import type { MemberLink, TeamMember } from '../team-member.types';
import { groupMembers } from '../team-grouping';
import { MemberCard, memberInitials } from './member-card';

export { memberInitials };

// The public Team tab (ADR-020): the director first on the shared identity card (MemberCard, the
// same one that heads every profile page), with their external links as pills and a Profile pill,
// so a visitor can reach their Scholar/ORCID/etc. without opening the profile. Then one grid of
// people per admin-defined team in the admin's order, then anyone on no team. Every other card
// links to that member's profile page.
//
// The teams are real `<section>`s with real headings rather than one list with visual dividers:
// "which team is this person on" is the structure of the page, so it has to survive being read by
// heading or by region, not only by looking at the gaps. Each grid is `aria-labelledby` its own
// heading, so a screen reader announces "Research Team, list, 4 items".

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

export function TeamMembersView({
  members,
  directorLinks = [],
}: {
  members: TeamMember[];
  /** The director's `member_link` rows, shown as pills on their card. */
  directorLinks?: readonly MemberLink[];
}) {
  const { director, groups } = groupMembers(members);
  // The `rise` stagger runs down the whole page rather than restarting per team, so the cards
  // settle in reading order instead of columns animating in parallel.
  let cardIndex = 0;

  return (
    <div className="space-y-10">
      {director && (
        <div style={{ '--i': cardIndex++ } as React.CSSProperties} className="rise">
          <MemberCard
            member={director}
            links={directorLinks}
            eyebrow={`Lab Director · ${director.role}`}
            showProfileLink
          />
        </div>
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
