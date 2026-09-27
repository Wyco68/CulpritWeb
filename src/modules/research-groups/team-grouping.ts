import type { TeamRef } from './team.types';

// Pure grouping for the public Team tab (ADR-020). No I/O, so it is unit-tested directly.

/** One block of the Team tab: a team and its members, or the members with no team. */
export type MemberGroup<M> = { team: TeamRef | null; members: M[] };

/**
 * The Team tab's layout: the director on their own, then each team in the admin's order
 * (`sortOrder`, then name), then anyone on no team. Within a group, members keep the order the
 * caller passed them in — the service already returns them by `sortOrder`.
 *
 * Teams with nobody in them are dropped — a heading with nobody under it is noise on a public page.
 */
export function groupMembers<M extends { isDirector: boolean; team: TeamRef | null }>(
  members: readonly M[],
): { director: M | null; groups: MemberGroup<M>[] } {
  const director = members.find((member) => member.isDirector) ?? null;
  const rest = members.filter((member) => !member.isDirector);

  const teams = new Map<string, TeamRef>();
  for (const member of rest) if (member.team) teams.set(member.team.id, member.team);
  const ordered = [...teams.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );

  const groups: MemberGroup<M>[] = ordered.map((team) => ({
    team,
    members: rest.filter((member) => member.team?.id === team.id),
  }));
  const unassigned = rest.filter((member) => !member.team);
  if (unassigned.length > 0) groups.push({ team: null, members: unassigned });

  return { director, groups };
}
