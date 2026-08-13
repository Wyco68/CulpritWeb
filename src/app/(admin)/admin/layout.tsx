import { redirect } from 'next/navigation';
import { requireAdmin } from '@/modules/auth';
import { AdminHeader } from './_components/admin-header';

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
    <div className="flex min-h-screen flex-col">
      <AdminHeader adminName={session.data.name} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
