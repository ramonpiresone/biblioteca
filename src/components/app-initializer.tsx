
'use client';

import { useAuth } from '@/contexts/auth-context';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import { Loader } from '@/components/ui/loader';

export function AppInitializer({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return; // Wait until auth state is determined

    const isAuthPage = pathname === '/login';

    if (!user && !isAuthPage) {
      router.replace('/login');
    } else if (user && isAuthPage) {
      router.replace('/');
    }
  }, [user, loading, pathname, router]);

  // Show loader if:
  // 1. Auth state is loading
  // 2. User is not authenticated AND not on the login page (implies redirect is imminent)
  // 3. User is authenticated AND on the login page (implies redirect is imminent)
  if (loading || (!user && pathname !== '/login') || (user && pathname === '/login')) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader size={48} />
      </div>
    );
  }

  return <>{children}</>;
}
