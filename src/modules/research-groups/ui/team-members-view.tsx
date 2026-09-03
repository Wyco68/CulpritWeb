'use client';

import { useState } from 'react';
import { ArrowRight, Users } from 'lucide-react';
import { Avatar } from '@/modules/shared/ui/avatar';
import { Button } from '@/modules/shared/ui/button';
import { Dialog } from '@/modules/shared/ui/dialog';
import { panelClassName } from '@/modules/shared/ui/card';
// Deep imports, not the barrel — the barrel re-exports Prisma-backed service getters; even a
// type-only barrel import drags Prisma/`pg` into the client bundle (confirmed empirically).
import type { ResearchGroup } from '../research-group.types';
import type { TeamMember } from '../team-member.types';

// Public surfacing of research groups (spec FR-4) — no separate "Research Groups" tab; the teams
// ARE that tab.
//
// One uniform card per team, and the roster lives behind it rather than on it. Rendering every
// member inline made the page as tall as the largest team and gave a visitor no overview at all:
// they had to scroll past twenty people to discover a second team exists. The card now answers
// "what teams are there, and how big", and a click answers "who is in this one".

function MemberRow({ member }: { member: TeamMember }) {
  return (
    <li className="flex gap-4 border-t border-border py-4 first:border-t-0 first:pt-0">
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
          {member.nickname && (
            <span className="ml-2 text-base text-muted-foreground">({member.nickname})</span>
          )}
        </p>
        <p className="mt-1 break-words text-sm text-accent">{member.role}</p>
        {member.bio && (
          <p className="mt-2 text-pretty break-words text-sm leading-relaxed text-muted-foreground">
            {member.bio}
          </p>
        )}
      </div>
    </li>
  );
}

/** A team plus the people in it — the shape both the card and the dialog need. */
type TeamCard = { id: string; name: string; description?: string; members: TeamMember[] };

function TeamDetailDialog({
  open,
  onOpenChange,
  team,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: TeamCard;
}) {
  if (!team) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={team.name}
      description={team.description || undefined}
      closeLabel="Close"
      className="max-w-2xl"
    >
      <h3 className="font-mono text-xs uppercase leading-5 tracking-[0.12em] text-muted-foreground">
        Members
        <span className="tabular ml-2">{team.members.length}</span>
      </h3>
      {team.members.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nobody listed in this team yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col">
          {team.members.map((member) => (
            <MemberRow key={member.id} member={member} />
          ))}
        </ul>
      )}
    </Dialog>
  );
}

export function TeamMembersView({
  groups,
  ungrouped,
}: {
  groups: ResearchGroup[];
  ungrouped: TeamMember[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  // Teams with nobody in them are dropped: a visitor can do nothing with an empty roster, and it
  // reads as a broken page rather than as a team yet to be staffed.
  const teams: TeamCard[] = [
    ...groups
      .filter((group) => group.teamMembers.length > 0)
      .map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        members: group.teamMembers,
      })),
    // People in no team are collected under one card so they stay reachable, rather than being
    // invisible because they happen not to be assigned.
    ...(ungrouped.length > 0 ? [{ id: '__ungrouped', name: 'Other', members: ungrouped }] : []),
  ];

  const open = teams.find((team) => team.id === openId);

  return (
    <>
      <ul className="grid gap-5 sm:grid-cols-2">
        {teams.map((team, index) => (
          <li
            key={team.id}
            style={{ '--i': index } as React.CSSProperties}
            className={`rise flex h-full flex-col ${panelClassName}`}
          >
            <h3 className="text-balance break-words font-serif text-xl leading-snug text-foreground sm:text-2xl">
              {team.name}
            </h3>

            {team.description && (
              // Clamped so one wordy description cannot make its card taller than the rest.
              <p className="mt-2 line-clamp-3 text-pretty break-words leading-[1.7] text-muted-foreground">
                {team.description}
              </p>
            )}

            {/* A row of faces says "a team of six people" faster than the number does, and it is
                the one thing worth previewing on the card itself. */}
            <ul aria-hidden="true" className="mt-4 flex flex-wrap gap-1.5">
              {team.members.slice(0, 6).map((member) => (
                <li key={member.id}>
                  <Avatar
                    src={member.photoUrl}
                    alt=""
                    fallback={member.name.slice(0, 1).toUpperCase()}
                    size="sm"
                  />
                </li>
              ))}
            </ul>

            {/* `mt-auto` pins the footer down, so buttons align across a row of uneven cards. */}
            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
              <p className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                <Users className="size-3.5" aria-hidden="true" />
                <span className="tabular">{team.members.length}</span>
                <span>{team.members.length === 1 ? 'member' : 'members'}</span>
              </p>
              <Button
                variant="outline"
                size="sm"
                aria-label={`Show detail: ${team.name}`}
                onClick={() => setOpenId(team.id)}
              >
                Show detail
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <TeamDetailDialog
        open={Boolean(open)}
        onOpenChange={(next) => !next && setOpenId(null)}
        team={open}
      />
    </>
  );
}
