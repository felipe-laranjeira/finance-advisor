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
        // First try to get the session from local storage/cookies
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          throw sessionError;
        }

        if (session) {
          // Verify the user is still valid with the server
          const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser();
          
          if (userError) {
            throw userError;
          }
          
          setUser(verifiedUser);
        } else {
          setUser(null);
          if (pathname !== '/' && !['/painel', '/receitas', '/despesas', '/investimentos'].some(path => pathname.startsWith(path))) {
            // Only redirect if we are on a protected route
            // router.push('/');
          }
        }
      } catch (err: any) {
        const errorMessage = err.message || '';
        if (
          errorMessage.includes('Refresh Token Not Found') || 
          errorMessage.includes('invalid_refresh_token') ||
          errorMessage.includes('refresh_token_not_found')
        ) {
          console.warn('Sessão expirada ou inválida. Limpando dados...');
          // Use a try-catch for signOut to avoid infinite loops if it fails
          try {
            await supabase.auth.signOut();
          } catch (signOutErr) {
            // If signOut fails, manually clear local storage as a fallback
            if (typeof window !== 'undefined') {
              localStorage.removeItem('supabase.auth.token');
            }
          }
          setUser(null);
          if (pathname !== '/') {
            router.push('/');
          }
        } else {
          console.error('Erro de autenticação:', errorMessage);
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
