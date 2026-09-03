'use client';

import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Button } from '@/modules/shared/ui/button';
import { signOut } from '../auth-client';

export function LogoutButton() {
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
      variant="ghost"
      size="sm"
      loading={loading}
      onClick={handleLogout}
      className="font-semibold text-masthead-foreground hover:bg-masthead-foreground/10 hover:text-accent-on-band"
    >
      <LogOut className="size-4" aria-hidden="true" />
      Log out
    </Button>
  );
}
