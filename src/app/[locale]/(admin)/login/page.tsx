import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { requireAdmin } from '@/modules/auth';
import { LoginForm } from '@/modules/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/modules/shared/ui/card';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.login');
  return { title: t('metaTitle') };
}

// The admin sign-in page. `(admin)` route group + this page's own segment resolve to the bare
// `/login` path (sibling to `/admin`, not nested under it) so an unauthenticated visitor never
// passes through the guarded admin layout to reach it. Already-authenticated admins are bounced
// straight to the dashboard — no point showing a login form to someone with a live session.
export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await requireAdmin();
  if (session.ok) redirect({ href: '/admin', locale });

  const t = await getTranslations('admin.login');

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-6 py-12">
      <Card className="w-full max-w-sm border-navy-foreground/10 bg-background shadow-xl">
        <CardHeader className="items-center text-center">
          <div className="mb-1 inline-flex size-11 items-center justify-center rounded-full bg-accent/10 text-accent">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </div>
          <CardTitle className="text-xl">{t('title')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
