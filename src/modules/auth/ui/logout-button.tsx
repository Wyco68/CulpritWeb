'use client';

import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Button } from '@/modules/shared/ui/button';
import { signOut } from '../auth-client';

/** `band` sits on the masthead band; `sheet` is the full-width action in the mobile menu. */
export function LogoutButton({ surface = 'band' }: { surface?: 'band' | 'sheet' }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await signOut();
      // The public site, not /login. Signing out is "I'm done here", not "let me back in" — and
      // bouncing to the sign-in form makes it look as though the sign-out failed and it is asking
      // for credentials again.
      router.push('/');
      router.refresh();
    } catch {
      toast.error('Could not log out. Please try again.');
      setLoading(false);
    }
  }

  return (
    <Button
      variant={surface === 'band' ? 'onBand' : 'outline'}
      size={surface === 'band' ? 'sm' : 'lg'}
      loading={loading}
      onClick={handleLogout}
      className={surface === 'sheet' ? 'w-full' : undefined}
    >
      <LogOut className="size-4" aria-hidden="true" />
      Log out
    </Button>
  );
}
