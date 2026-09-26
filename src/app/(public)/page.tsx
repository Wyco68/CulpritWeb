import type { Metadata } from 'next';
import { getProfileCached } from '@/modules/profile';
import { getTeamMemberService, MemberCard } from '@/modules/research-groups';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { LoadErrorState } from '@/modules/shared/ui/error-state';
import { PageHeading } from '@/modules/shared/ui/page-heading';
import { Standfirst } from '@/modules/shared/ui/prose';
import { toMetaDescription } from './_lib/page-meta';

const FALLBACK_DESCRIPTION = 'About the lab, its work, and its director.';

export async function generateMetadata(): Promise<Metadata> {
  const result = await getProfileCached();

  return {
    title: 'About',
    description: toMetaDescription(
      result.ok ? result.data?.labOverview : null,
      FALLBACK_DESCRIPTION,
    ),
  };
}

export default async function AboutPage() {
  // The lab overview plus a card for the director (ADR-016). Her CV lives on her own profile page,
  // which the card links to; her external links are her `member_link` rows, edited in the admin.
  const [profileResult, directorResult] = await Promise.all([
    getProfileCached(),
    getTeamMemberService().findDirectorProfile(),
  ]);

  const overview = profileResult.ok ? profileResult.data?.labOverview : null;
  const directorProfile = directorResult.ok ? directorResult.data : null;

  return (
    <div>
      <PageHeading title="About" />

      {!profileResult.ok && !directorResult.ok ? (
        <LoadErrorState what="This page" className="mt-10" />
      ) : !overview && !directorProfile ? (
        <EmptyState title="Nothing here yet" className="mt-10" />
      ) : (
        <div className="mt-12 space-y-12">
          {overview && <Standfirst preserveLines>{overview}</Standfirst>}

          {directorProfile && (
            <MemberCard
              member={directorProfile.member}
              links={directorProfile.links}
              eyebrow={`Lab Director · ${directorProfile.member.role}`}
              showProfileLink
            />
          )}
        </div>
      )}
    </div>
  );
}
