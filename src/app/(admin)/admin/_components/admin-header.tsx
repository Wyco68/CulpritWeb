import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { LogoutButton } from '@/modules/auth';
import { AdminNav } from './admin-nav';

// The admin chrome's masthead hero band — deliberately the same `--masthead` brand surface as the public
// site header (per the Figma "Admin View" prototype) so the two apps read as one product, not two
// disconnected shells.
export async function AdminHeader({ adminName }: { adminName: string }) {
  return (
    <header className="bg-masthead text-masthead-foreground">
      <div className="mx-auto max-w-6xl px-6 pt-6">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2.5 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-on-band"
          >
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-accent-on-band/15 text-accent-on-band">
              <ShieldCheck className="size-4" aria-hidden="true" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight">The Culprit — Admin</span>
              <span className="text-xs text-masthead-foreground/70">{adminName}</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <LogoutButton />
          </div>
        </div>

        <div className="mt-5 border-t border-masthead-foreground/10">
          <AdminNav />
        </div>
      </div>
    </header>
  );
}
