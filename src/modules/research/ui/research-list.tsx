import { ExternalLink } from 'lucide-react';
import type { Research } from '@/modules/research';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/modules/shared/ui/card';

export function ResearchList({ items }: { items: Research[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.id}>
          <Card className="flex h-full flex-col">
            <CardHeader>
              <p className="font-mono text-xs uppercase tracking-widest text-accent">
                {item.area}
              </p>
              <CardTitle className="mt-1">{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <CardDescription className="leading-relaxed">{item.summary}</CardDescription>
              {item.link && (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 self-start rounded text-sm font-medium text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  View project
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
