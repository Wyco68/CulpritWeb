import { LogoutButton } from '@/modules/auth';
import { AdminNav } from './admin-nav';

// The admin masthead: the same band and tab bar as the public site header, headed by a fixed
// "Admin Panel" label. Static text on purpose — no photo, no icon, and no profile read, so the
// header never waits on the database and never changes when the lab profile is edited.
export function AdminHeader() {
  return (
    <header className="bg-masthead text-masthead-foreground">
      <div className="mx-auto max-w-6xl px-6 pt-14 sm:px-8 sm:pt-20">
        <p className="font-serif text-[2.125rem] font-normal leading-[1.05] tracking-[-0.02em] sm:text-6xl">
          Admin Panel
        </p>

        <div className="mt-10 flex items-end justify-between gap-4 border-t border-masthead-foreground/12 sm:mt-14">
          <div className="min-w-0 flex-1">
            <AdminNav />
          </div>
          <div className="shrink-0 pb-2">
            <LogoutButton />
          </div>
        </div>
      </div>
    </header>
  );
}
