import type * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardDescription } from '@/modules/shared/ui/card';
import { Guilloche } from '@/modules/shared/ui/guilloche';

// The signed-out admin pages' frame — sign-in and forgot password: the masthead ground and its
// rosette, full page, behind a plain card. The one place the ornament gets room to be the focal
// point. `[--ring]` keeps focus visible on the band's links.

export interface AuthCardShellProps {
  title: string;
  description: string;
  icon: LucideIcon;
  /** The link under the card. */
  backHref: string;
  backLabel: string;
  children: React.ReactNode;
}

export function AuthCardShell({
  title,
  description,
  icon: Icon,
  backHref,
  backLabel,
  children,
}: AuthCardShellProps) {
  return (
    <main className="masthead-ground relative isolate flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 py-12 text-masthead-foreground [--ring:var(--accent-on-band)]">
      <Guilloche className="engrave absolute left-1/2 top-1/2 -z-10 size-[44rem] -translate-x-1/2 -translate-y-1/2 text-engraving/30 sm:size-[56rem]" />

      <Card className="w-full max-w-sm text-foreground shadow-raised [--ring:var(--accent)]">
        <CardHeader className="items-center pb-4 text-center">
          <div className="mb-1 inline-flex size-12 items-center justify-center rounded-full bg-accent/10 text-accent">
            <Icon className="size-5" aria-hidden="true" />
          </div>
          {/* The page's only h1. */}
          <h1 className="font-serif text-2xl font-normal text-foreground">{title}</h1>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>

      <Link
        href={backHref}
        className="focus-ring mt-8 inline-flex items-center gap-2 rounded-sm text-sm text-masthead-foreground/80 transition-colors duration-200 hover:text-masthead-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {backLabel}
      </Link>
    </main>
  );
}
