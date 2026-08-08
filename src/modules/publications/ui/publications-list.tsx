import { ExternalLink } from 'lucide-react';
import type { Publication } from '@/modules/publications';

// Monospaced two-digit numbered index (01, 02, …), per the Figma prototype's numbered-list
// pattern for publications.
export function PublicationsList({ items }: { items: Publication[] }) {
  return (
    <ol className="divide-y divide-border border-t border-border">
      {items.map((item, index) => (
        <li key={item.id} className="flex gap-4 py-5 sm:gap-6">
          <span
            aria-hidden="true"
            className="shrink-0 pt-0.5 font-mono text-sm text-muted-foreground"
          >
            {String(index + 1).padStart(2, '0')}
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-medium leading-snug tracking-tight text-foreground">
              {item.title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{item.authors}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="italic">{item.venue}</span>
              {' · '}
              <span className="font-mono">{item.year}</span>
            </p>
            {item.link && (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 rounded text-sm font-medium text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                View publication
                <ExternalLink className="size-3.5" aria-hidden="true" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
