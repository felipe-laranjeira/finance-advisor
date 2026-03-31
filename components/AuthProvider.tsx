'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.warn('Auth session error, clearing session:', error.message);
          // If refresh token is invalid, sign out to clear local storage
          await supabase.auth.signOut();
          setUser(null);
          if (pathname !== '/') {
            router.push('/');
          }
        } else if (session) {
          setUser(session.user);
        } else {
          setUser(null);
          if (pathname !== '/') {
            router.push('/');
          }
        }
      } catch (err) {
        console.error('Unexpected auth error:', err);
        setUser(null);
        if (pathname !== '/') {
          router.push('/');
        }
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setUser(session.user);
        setLoading(false);
      } else if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setLoading(false);
        if (pathname !== '/') {
          router.push('/');
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, pathname]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
