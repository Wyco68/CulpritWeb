import { redirect } from 'next/navigation';
import { requireAdmin } from '@/modules/auth';
import { AdminHeader, AdminSidebar } from './_components/admin-header';

// The authoritative admin gate. Every page under `/admin/*` is a child of this layout, so a
// single server-side `requireAdmin()` check here guards the whole section — re-checked on every
// request (Server Components aren't cached across navigations the way client route guards would
// be), reading session state straight from the DB per `requireAdmin`'s contract. Any client-side
// affordance (hiding a nav link, etc.) would be UX only; this is the real boundary.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  if (!session.ok) {
    redirect('/login');
    // `redirect` always throws (NEXT_REDIRECT); the explicit throw below is a type-narrowing aid
    // only — TS doesn't always infer unreachability through the imported call alone.
    throw new Error('unreachable');
  }

  return (
    // White body, the same treatment as the public site: `--background` is re-pointed at
    // `--surface` for this subtree, so dialogs and sticky bars turn white with it.
    // `data-shell` sets the admin's shorter pinned-header height (`--header-h`, globals.css).
    <div
      data-shell="admin"
      className="flex min-h-screen flex-col bg-background [--background:var(--surface)]"
    >
      <AdminHeader />
      <div className="flex-1 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)]">
        <AdminSidebar />
        <main className="mx-auto w-full min-w-0 max-w-6xl px-6 py-10 sm:px-10 sm:py-14">
          {children}
        </main>
      </div>
    </div>
  );
}
