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
        
        // Initial session check
        let existingSession = null;
        try {
          const { data, error: initialError } = await supabase.auth.getSession();
          if (initialError) {
            console.warn('Supabase getSession error:', initialError.message);
            // If tokens are broken, sign out to clear them
            if (
              initialError.message.includes('Refresh Token Not Found') || 
              initialError.message.includes('refresh_token_not_found') ||
              initialError.message.includes('invalid refresh token')
            ) {
               console.info('Cleaning up stale session...');
               localStorage.removeItem('app_user');
               await supabase.auth.signOut();
            }
          }
          existingSession = data.session;
        } catch (sessErr) {
          console.error('Failed to get initial session:', sessErr);
        }
        
        const storedUser = localStorage.getItem('app_user');
        if (storedUser) {
          try {
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
                    sessionError.message.includes('refresh_token_not_found') ||
                    sessionError.message.includes('invalid_grant') ||
                    sessionError.message.includes('Refresh token has expired') ||
                    sessionError.message.includes('invalid refresh token')
                  ) {
                    localStorage.removeItem('app_user');
                    setUser(null);
                    await supabase.auth.signOut();
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
            
            // Re-verify current session
            const { data: { session: currentSession }, error: sessionCheckError } = await supabase.auth.getSession();
            
            if (sessionCheckError || !currentSession) {
               console.warn('No active session after restore attempt');
               localStorage.removeItem('app_user');
               setUser(null);
               await supabase.auth.signOut();
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
              // If session expired or token invalid
              if (
                error.code === 'PGRST301' || 
                error.message.includes('permission denied') || 
                error.message.includes('JWT expired') ||
                error.message.includes('Refresh Token Not Found')
              ) {
                 console.warn('Sessão expirada ou acesso negado.');
                 await supabase.auth.signOut();
                 localStorage.removeItem('app_user');
                 setUser(null);
                 if (pathname !== '/' && pathname !== '/registrar') {
                   router.push('/');
                 }
                 return;
              }
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
          } catch (parseErr) {
            console.error('Error parsing stored user:', parseErr);
            localStorage.removeItem('app_user');
            setUser(null);
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
      console.log(`Auth event: ${event}`);
      
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
        const storedUser = localStorage.getItem('app_user');
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            // Only update if it's the same user or if we don't have a user yet
            if (!user || user.id === session.user.id) {
              const updatedUser = {
                ...parsedUser,
                session: {
                  access_token: session.access_token,
                  refresh_token: session.refresh_token,
                  expires_at: session.expires_at,
                  expires_in: session.expires_in,
                  token_type: session.token_type,
                  user: session.user
                }
              };
              localStorage.setItem('app_user', JSON.stringify(updatedUser, getCircularReplacer()));
              // We don't necessarily call setUser here to avoid infinite loops if this is called during render
              // but the session is now synced for the next reload
            }
          } catch (err) {
            console.error('Error updating stored session:', err);
          }
        }
      }

      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('app_user');
        setUser(null);
        if (pathname !== '/' && pathname !== '/registrar') {
          router.push('/');
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, pathname, user]);

  const login = async (userData: AppUser) => {
    // If a Supabase session was provided, set it in the client
    if (userData.session && userData.session.access_token && userData.session.refresh_token) {
      const { session } = userData;
      try {
        const { error } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token
        });
        
        if (error) {
          console.error('Erro ao estabelecer sessão no Supabase:', error.message);
        } else {
          console.info('Sessão Supabase sincronizada com sucesso.');
        }
      } catch (err) {
        console.error('Critical error in setSession during login:', err);
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
