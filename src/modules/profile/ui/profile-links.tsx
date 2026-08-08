import { ExternalLink } from 'lucide-react';
import type { Profile } from '@/modules/profile';

// External academic/professional profiles. Rendered as a compact row directly under the bio,
// where a reader looking for "where else can I find this person" expects it — above the CV
// sections rather than buried at the foot of them. Renders nothing when no link is set, so the
// About tab has no empty scaffolding before the admin fills it in.

const LINKS = [
  { field: 'linkedinUrl', key: 'linkedin', label: 'LinkedIn' },
  { field: 'googleScholarUrl', key: 'googleScholar', label: 'Google Scholar' },
] as const satisfies readonly { field: keyof Profile; key: string; label: string }[];

export function ProfileLinks({ profile }: { profile: Profile }) {
  const present = LINKS.flatMap(({ field, key, label }) => {
    const href = profile[field] as string | null;
    return href ? [{ key, href, label }] : [];
  });

  if (present.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2">
      {present.map(({ key, href, label }) => (
        <li key={key}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {label}
            <ExternalLink className="size-3.5" aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
