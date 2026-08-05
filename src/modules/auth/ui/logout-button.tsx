'use client';

import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/modules/shared/ui/button';
import { signOut } from '../auth-client';

export function LogoutButton() {
  const t = useTranslations('admin.nav');
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await signOut();
      router.push('/login');
      router.refresh();
    } catch {
      toast.error(t('logoutError'));
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      loading={loading}
      onClick={handleLogout}
      className="text-navy-foreground/80 hover:bg-navy-foreground/10 hover:text-navy-foreground"
    >
      <LogOut className="size-4" aria-hidden="true" />
      {t('logout')}
    </Button>
  );
}
