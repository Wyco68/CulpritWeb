import Link from 'next/link';
import { ArrowUpRight, GraduationCap } from 'lucide-react';
import { Avatar } from '@/modules/shared/ui/avatar';
import { memberInitials } from './team-members-view';
import type { MemberLink, TeamMember } from '../team-member.types';

// A member's identity card: portrait, one eyebrow line, name, affiliation and their links as pills.
// The one treatment for a person at the head of a page — the About tab's director card and the top
// of every member profile — so the two never drift into separate designs. Every value comes from
// the member row and its `member_link` rows; nothing here is hardcoded.

const pillClassName =
  'inline-flex items-center gap-1.5 rounded-full border border-border bg-masthead px-3 py-1.5 text-sm font-medium text-accent-on-band transition-[background-color,color,scale] duration-200 ease-[var(--ease-out-expo)] hover:bg-accent hover:text-accent-foreground active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export function MemberCard({
  member,
  links,
  eyebrow,
  as: Name = 'h3',
  showProfileLink = false,
}: {
  member: Pick<TeamMember, 'id' | 'name' | 'role' | 'affiliation' | 'photoUrl'>;
  links: readonly Pick<MemberLink, 'id' | 'label' | 'url'>[];
  /** The line above the name, e.g. "Lab Director · Assistant Professor". Defaults to the role. */
  eyebrow?: string;
  /** Heading level of the name: `h2` when the card heads its own page, `h3` inside a tab. */
  as?: 'h2' | 'h3';
  /** Adds a "Profile" pill linking to the member's page — pointless on that page itself. */
  showProfileLink?: boolean;
}) {
  const headingId = `member-${member.id}`;

  return (
    <section
      aria-labelledby={headingId}
      className="flex max-w-3xl flex-col gap-6 rounded-xl border border-border bg-surface p-7 shadow-sm sm:flex-row sm:items-center sm:gap-8"
    >
      <Avatar
        src={member.photoUrl}
        alt={`Portrait of ${member.name}`}
        fallback={memberInitials(member.name)}
        size="lg"
        shape="circle"
      />
      <div className="min-w-0">
        <p className="break-words font-mono text-xs font-semibold uppercase tracking-[0.12em] text-accent">
          {eyebrow ?? member.role}
        </p>
        <Name
          id={headingId}
          className="mt-2 text-balance break-words text-3xl font-bold leading-tight tracking-[-0.02em] text-foreground"
        >
          {member.name}
        </Name>
        {member.affiliation && (
          <p className="mt-1 whitespace-pre-line break-words text-muted-foreground">
            {member.affiliation}
          </p>
        )}

        {(showProfileLink || links.length > 0) && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {showProfileLink && (
              <li>
                <Link href={`/team/${member.id}`} className={pillClassName}>
                  <GraduationCap className="size-3.5" aria-hidden="true" />
                  Profile
                </Link>
              </li>
            )}
            {links.map((link) => (
              <li key={link.id}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={pillClassName}
                >
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  {link.label}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
