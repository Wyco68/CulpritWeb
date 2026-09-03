import { getTeamMemberService } from '@/modules/research-groups';
import { PrismaEventRepository } from './event.repository';
import { createEventService, type EventService, type TeamMemberDirectory } from './event.service';

// Composition root: wires the Prisma-backed repository into the service. Route handlers and
// Server Components call getEventService() and nothing else.

/**
 * The events module's view of team-member data, satisfied by the research-groups service.
 *
 * It lives here rather than in the service so the dependency between the two modules is declared
 * in one composition file instead of being buried in business logic — the service only knows the
 * `TeamMemberDirectory` shape, and never imports another module's repository or Prisma.
 *
 * Both reads throw on failure rather than returning a Result: the service already wraps every call
 * in try/catch and maps thrown errors through `toAppError`, so unwrapping here keeps the port's
 * signature to the two fields events actually needs.
 */
const teamMemberDirectory: TeamMemberDirectory = {
  async byId(id) {
    // A primary-key lookup. This used to list every team member and `.find()` in memory, which
    // read the whole table to answer a question about one row.
    const result = await getTeamMemberService().findById(id);
    if (!result.ok) throw result.error;
    const member = result.data;
    return member
      ? { id: member.id, name: member.name, role: member.role, photoUrl: member.photoUrl }
      : null;
  },

  async byGroup(researchGroupId) {
    const result = await getTeamMemberService().list({ groupId: researchGroupId });
    if (!result.ok) throw result.error;
    return result.data.map((member) => ({
      id: member.id,
      name: member.name,
      role: member.role,
      photoUrl: member.photoUrl,
    }));
  },
};

let cached: EventService | undefined;

export function getEventService(): EventService {
  if (!cached) {
    cached = createEventService({
      repository: new PrismaEventRepository(),
      teamMembers: teamMemberDirectory,
    });
  }
  return cached;
}
