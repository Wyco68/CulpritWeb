import { PageSkeleton } from '@/modules/shared/ui/page-skeleton';

// Suspense boundary for every /admin/* page. Sits *inside* the admin layout, so the layout's
// `requireAdmin()` gate is unaffected — the skeleton only ever replaces authenticated content
// while the page's own data loads. Admin tables are taller than public prose, hence more rows.
export default async function AdminLoading() {
  return <PageSkeleton label="Loading…" rows={6} />;
}
