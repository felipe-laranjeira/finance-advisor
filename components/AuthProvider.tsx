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
        const storedUser = localStorage.getItem('app_user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);

          // Restore Supabase session if it exists in stored user data
          if (parsedUser.session) {
            try {
              const { error: sessionError } = await supabase.auth.setSession({
                access_token: parsedUser.session.access_token,
                refresh_token: parsedUser.session.refresh_token
              });
              
              if (sessionError) {
                console.warn('Failed to restore Supabase session:', sessionError.message);
                if (sessionError.message.includes('Refresh Token Not Found') || sessionError.message.includes('invalid_grant')) {
                  localStorage.removeItem('app_user');
                  setUser(null);
                  setLoading(false);
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
          
          // Verify user status in DB using standard client
          // If RLS is enabled, this will only work if we have a valid session
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', parsedUser.id)
            .single();

          if (error) {
            console.error('Erro ao verificar usuário no banco:', error.message);
            // If it's a permission error (PGRST301), it means session expired but user is in localstorage
            if (error.code === 'PGRST301' || error.message.includes('permission denied')) {
               console.warn('RLS bloqueou acesso. Redirecionando para login.');
            }
            
            localStorage.removeItem('app_user');
            setUser(null);
            if (pathname !== '/' && pathname !== '/registrar') {
              router.push('/');
            }
            setLoading(false);
            return;
          }

          if (data && data.status === 'Active') {
            setUser(data);
          } else {
            console.warn('Sessão inválida ou usuário inativo.');
            localStorage.removeItem('app_user');
            setUser(null);
            if (pathname !== '/' && pathname !== '/registrar') {
              router.push('/');
            }
          }
        } else {
          setUser(null);
          if (pathname !== '/' && pathname !== '/registrar' && !['/painel', '/receitas', '/despesas', '/investimentos', '/orcamento'].some(path => pathname.startsWith(path))) {
            // Keep current logic
          } else if (['/painel', '/receitas', '/despesas', '/investimentos', '/orcamento'].some(path => pathname.startsWith(path))) {
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
