import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { LogoutButton } from '@/modules/auth';
import { AdminNav } from './admin-nav';

// The admin chrome's navy hero band — deliberately the same `--navy` brand surface as the public
// site header (per the Figma "Admin View" prototype) so the two apps read as one product, not two
// disconnected shells.
export async function AdminHeader({ adminEmail }: { adminEmail: string }) {
  return (
    <header className="bg-navy text-navy-foreground">
      <div className="mx-auto max-w-6xl px-6 pt-6">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2.5 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-accent/15 text-accent">
              <ShieldCheck className="size-4" aria-hidden="true" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight">The Culprit — Admin</span>
              <span className="text-xs text-navy-foreground/60">{adminEmail}</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <LogoutButton />
          </div>
        </div>

        <div className="mt-5 border-t border-navy-foreground/10">
          <AdminNav />
        </div>
      </div>
    </header>
  );
}
