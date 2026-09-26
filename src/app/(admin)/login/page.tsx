import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/modules/auth';
import { LoginForm } from '@/modules/auth';
import { Card, CardContent, CardHeader, CardDescription } from '@/modules/shared/ui/card';
import { Guilloche } from '@/modules/shared/ui/guilloche';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Admin Login' };
}

// The admin sign-in page. `(admin)` route group + this page's own segment resolve to the bare
// `/login` path (sibling to `/admin`, not nested under it) so an unauthenticated visitor never
// passes through the guarded admin layout to reach it. Already-authenticated admins are bounced
// straight to the dashboard — no point showing a login form to someone with a live session.
export default async function LoginPage() {
  const session = await requireAdmin();
  if (session.ok) redirect('/admin');

  return (
    // The masthead ground and its rosette, full page: the one place the ornament gets room to be
    // the focal point, behind a plain card. `[--ring]` keeps focus visible on the band's links.
    <div className="masthead-ground relative isolate flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 py-12 text-masthead-foreground [--ring:var(--accent-on-band)]">
      <Guilloche className="engrave absolute left-1/2 top-1/2 -z-10 size-[44rem] -translate-x-1/2 -translate-y-1/2 text-engraving/30 sm:size-[56rem]" />

      <Card className="w-full max-w-sm text-foreground shadow-raised [--ring:var(--accent)]">
        <CardHeader className="items-center pb-4 text-center">
          <div className="mb-1 inline-flex size-12 items-center justify-center rounded-full border-[3px] border-double border-engraving/60 text-accent">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </div>
          {/* The page's only heading. */}
          <h1 className="font-serif text-2xl font-normal text-foreground">Admin Login</h1>
          <CardDescription>Manage the content of The Culprit.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>

      <Link
        href="/"
        className="focus-ring mt-8 inline-flex items-center gap-2 rounded-sm text-sm text-masthead-foreground/80 transition-colors duration-200 hover:text-masthead-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to the site
      </Link>
    </div>
  );
}
