'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { SessionManager } from './SessionManager';
import { getCircularReplacer } from '@/lib/utils';

interface AppUser {
  id: string;
  name: string;
  email: string;
  photo_url?: string;
  status: 'Active' | 'Inactive';
  session?: any; // Include Supabase session
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (userData: AppUser) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (userData: Partial<AppUser>) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  signOut: async () => {},
  updateUser: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkUser = async () => {
      try {
        setLoading(true);
        // Check if Supabase already has a session (it persists by itself if configured)
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        const storedUser = localStorage.getItem('app_user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);

          // If Supabase doesn't have a session but we have one in localStorage, try to restore it
          if (!existingSession && parsedUser.session) {
            try {
              const { error: sessionError } = await supabase.auth.setSession({
                access_token: parsedUser.session.access_token,
                refresh_token: parsedUser.session.refresh_token
              });
              
              if (sessionError) {
                console.warn('Failed to restore Supabase session:', sessionError.message);
                // Clear state on common authentication failures
                if (
                  sessionError.message.includes('Refresh Token Not Found') || 
                  sessionError.message.includes('invalid_grant') ||
                  sessionError.message.includes('Refresh token has expired')
                ) {
                  localStorage.removeItem('app_user');
                  setUser(null);
                  if (pathname !== '/' && pathname !== '/registrar') {
                    router.push('/');
                  }
                  return;
                }
              }
            } catch (sessErr) {
              console.error('Critical error restoring session:', sessErr);
            }
          }
          
          // Obtain current session (after potential restore)
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          
          if (!currentSession) {
             // No valid Supabase session, clear local user state too if they were supposed to be logged in
             localStorage.removeItem('app_user');
             setUser(null);
             if (pathname !== '/' && pathname !== '/registrar') {
               router.push('/');
             }
             return;
          }

          // Verify user status in DB
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', parsedUser.id)
            .single();

          if (error) {
            console.error('Erro ao verificar usuário no banco:', error.message);
            // If it's a permission error (PGRST301), it means session expired or token invalid
            if (error.code === 'PGRST301' || error.message.includes('permission denied') || error.message.includes('JWT expired')) {
               console.warn('Sessão expirada ou acesso negado. Redirecionando para login.');
               await supabase.auth.signOut();
            }
            
            localStorage.removeItem('app_user');
            setUser(null);
            if (pathname !== '/' && pathname !== '/registrar') {
              router.push('/');
            }
            return;
          }

          if (data && data.status === 'Active') {
            setUser(data);
          } else {
            console.warn('Usuário inativo ou não encontrado.');
            await supabase.auth.signOut();
            localStorage.removeItem('app_user');
            setUser(null);
            if (pathname !== '/' && pathname !== '/registrar') {
              router.push('/');
            }
          }
        } else {
          // No stored user, ensure Supabase is also signed out
          if (existingSession) {
            await supabase.auth.signOut();
          }
          setUser(null);
          // Redirect if on a protected route
          const protectedRoutes = ['/painel', '/receitas', '/despesas', '/investimentos', '/orcamento'];
          if (protectedRoutes.some(path => pathname.startsWith(path))) {
            router.push('/');
          }
        }
      } catch (err: any) {
        console.error('Erro de autenticação customizada:', err.message);
      } finally {
        setLoading(false);
      }
    };

    checkUser();
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        if (!session) {
          localStorage.removeItem('app_user');
          setUser(null);
          if (pathname !== '/' && pathname !== '/registrar') {
            router.push('/');
          }
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, pathname]);

  const login = async (userData: AppUser) => {
    // If a Supabase session was provided, set it in the client
    if (userData.session) {
      const { session } = userData;
      const { error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token
      });
      
      if (error) {
        console.error('Erro ao estabelecer sessão no Supabase:', error.message);
      } else {
        console.info('Sessão Supabase sincronizada com sucesso.');
      }
    }

    localStorage.setItem('app_user', JSON.stringify(userData, getCircularReplacer()));
    setUser(userData);
    router.push('/painel');
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('app_user');
    setUser(null);
    router.push('/');
  };

  const updateUser = (userData: Partial<AppUser>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      localStorage.setItem('app_user', JSON.stringify(updatedUser, getCircularReplacer()));
      setUser(updatedUser);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signOut, updateUser }}>
      <SessionManager />
      {children}
    </AuthContext.Provider>
  );
};
