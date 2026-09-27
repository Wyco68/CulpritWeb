'use client';

// Prefetches on hover/focus rather than on sight — see intent-link.tsx.
import { IntentLink as Link } from '@/modules/shared/ui/intent-link';
import { usePathname } from 'next/navigation';
import { CalendarClock } from 'lucide-react';
import { buttonVariants } from '@/modules/shared/ui/button';
import { cn } from '@/modules/shared/lib/utils';

// The visitor's main action, lifted out of the tab strip so it is never the label that scrolls off
// a phone screen: the solid brand button, on the band and at the foot of the mobile menu sheet. It
// stays a link, and says so to assistive tech when it is the page being shown.
export function AppointmentAction({ surface }: { surface: 'band' | 'sheet' }) {
  const current = usePathname() === '/appointment';

  return (
    <Link
      href="/appointment"
      aria-current={current ? 'page' : undefined}
      className={cn(
        buttonVariants({ size: 'lg' }),
        surface === 'sheet' && 'w-full',
        // Current page: a ring around the button, so the state is not carried by the fill alone.
        current && 'ring-2 ring-offset-2',
        current && surface === 'band' && 'ring-accent-on-band ring-offset-masthead',
        current && surface === 'sheet' && 'ring-accent ring-offset-surface',
      )}
    >
      <CalendarClock className="size-4" aria-hidden="true" />
      Make Appointment
    </Link>
  );
}
