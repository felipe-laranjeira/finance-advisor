'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

/**
 * Hook to ensure a user is authenticated in client components.
 * Can be used in specific pages or layouts to force session validation.
 */
export function useRequireAuth(redirectTo: string = '/') {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push(redirectTo);
    }
  }, [user, loading, router, redirectTo]);

  return { user, loading, signOut };
}
