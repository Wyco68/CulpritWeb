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
      router.push('/login');
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
      className="font-semibold text-navy-foreground hover:bg-navy-foreground/10 hover:text-accent"
    >
      <LogOut className="size-4" aria-hidden="true" />
      Log out
    </Button>
  );
}
