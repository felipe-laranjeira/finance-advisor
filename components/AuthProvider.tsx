'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { SessionManager } from './SessionManager';

interface AppUser {
  id: string;
  name: string;
  email: string;
  photo_url?: string;
  status: 'Active' | 'Inactive';
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (userData: AppUser) => void;
  signOut: () => Promise<void>;
  updateUser: (userData: Partial<AppUser>) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: () => {},
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
          
          // Verify user status in DB
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', parsedUser.id)
            .single();

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

  const login = (userData: AppUser) => {
    localStorage.setItem('app_user', JSON.stringify(userData));
    setUser(userData);
    router.push('/painel');
  };

  const signOut = async () => {
    localStorage.removeItem('app_user');
    setUser(null);
    router.push('/');
  };

  const updateUser = (userData: Partial<AppUser>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      localStorage.setItem('app_user', JSON.stringify(updatedUser));
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
