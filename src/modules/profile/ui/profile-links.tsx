import { ArrowUpRight } from 'lucide-react';
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
    // Plain text links, not pill-shaped chips — the chip is stock-component shorthand for "tag",
    // and these are two outbound links. No rules of its own either: this row sits immediately
    // above a `border-t` section, so bounding it produced two horizontal lines a few pixels apart.
    <ul className="flex flex-wrap items-center gap-x-7 gap-y-2">
      {present.map(({ key, href, label }) => (
        <li key={key}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5 rounded-xs text-sm font-medium text-foreground underline-offset-4 transition-colors duration-300 ease-[var(--ease-out-expo)] hover:text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {label}
            <ArrowUpRight
              className="size-3.5 transition-[translate] duration-500 ease-[var(--ease-out-expo)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              aria-hidden="true"
            />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
