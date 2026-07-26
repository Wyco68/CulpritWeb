import { setRequestLocale } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Home />;
}

function Home() {
  const t = useTranslations('home');
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-24">
      <p className="font-mono text-sm uppercase tracking-widest text-accent">
        Information Security
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">{t('title')}</h1>
      <p className="mt-6 max-w-xl text-lg text-muted-foreground">{t('subtitle')}</p>
      <div className="mt-10">
        <Link
          href="/appointment"
          className="inline-flex items-center rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t('cta')}
        </Link>
      </div>
    </main>
  );
}
