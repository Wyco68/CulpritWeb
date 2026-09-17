import { LogoutButton } from '@/modules/auth';
import { getProfileCached } from '@/modules/profile';
import { AdminNav } from './admin-nav';

// The admin masthead, built exactly like the public site header so the two read as one product:
// the same band, the lab's name in the same type, and the tab bar beneath a rule. Only the lab
// name sits in the header — the admin's own name and any "Admin" badge stay out of it — and the
// tab bar carries Log out at its end.
//
// The name is a `<p>`, not the public header's `<h1>`: every admin screen already names itself
// with its own `h1`.

const DEFAULT_LAB_NAME = 'The Culprit';

export async function AdminHeader() {
  const result = await getProfileCached();
  const labName = (result.ok && result.data?.labName) || DEFAULT_LAB_NAME;

  return (
    <header className="bg-masthead text-masthead-foreground">
      <div className="mx-auto max-w-6xl px-6 pt-14 sm:px-8 sm:pt-20">
        <p className="text-pretty font-serif text-[2.125rem] font-normal leading-[1.05] tracking-[-0.02em] sm:text-6xl">
          {labName}
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
