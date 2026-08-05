import type { Research } from '@/modules/research';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/modules/shared/ui/card';

export function ResearchList({ items }: { items: Research[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.id}>
          <Card className="h-full">
            <CardHeader>
              <p className="font-mono text-xs uppercase tracking-widest text-accent">
                {item.area}
              </p>
              <CardTitle className="mt-1">{item.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="leading-relaxed">{item.summary}</CardDescription>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
