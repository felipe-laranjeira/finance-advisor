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
          // Check for the specific refresh token error
          if (error.message.includes('Refresh Token Not Found') || error.message.includes('invalid_refresh_token')) {
            console.warn('Sessão inválida detectada, limpando dados locais...');
            await supabase.auth.signOut();
            setUser(null);
            if (pathname !== '/') {
              router.push('/');
            }
          } else {
            console.warn('Erro de sessão:', error.message);
          }
        } else if (session) {
          setUser(session.user);
        } else {
          setUser(null);
          if (pathname !== '/' && pathname !== '/painel' && !pathname.startsWith('/receitas') && !pathname.startsWith('/despesas')) {
            // Only redirect if we are not on a protected route that handles its own loading
            // But actually, usually we want to redirect to / if no session
            router.push('/');
          }
        }
      } catch (err: any) {
        if (err.message?.includes('Refresh Token Not Found')) {
          await supabase.auth.signOut();
        }
        console.error('Erro inesperado de autenticação:', err);
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
