'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
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
  const checkingRef = useRef(false);

  // Memoize signOut to prevent re-renders in children like SessionManager
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('app_user');
      setUser(null);
      router.push('/');
    }
  }, [router]);

  // Memoize login
  const login = useCallback(async (userData: AppUser) => {
    // If a Supabase session was provided, set it in the client
    if (userData.session && userData.session.access_token && userData.session.refresh_token) {
      const { session } = userData;
      try {
        await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token
        });
        console.info('Sessão Supabase sincronizada no login.');
      } catch (err) {
        console.error('Erro ao sincronizar sessão no login:', err);
      }
    }

    localStorage.setItem('app_user', JSON.stringify(userData, getCircularReplacer()));
    setUser(userData);
    router.push('/painel');
  }, [router]);

  // Memoize updateUser
  const updateUser = useCallback((userData: Partial<AppUser>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...userData };
      localStorage.setItem('app_user', JSON.stringify(updated, getCircularReplacer()));
      return updated;
    });
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      if (checkingRef.current) return;
      
      try {
        checkingRef.current = true;
        // Check if we already have a user in state to avoid redundant checks on path change
        const isProtectedRoute = pathname !== '/' && pathname !== '/registrar';
        if (user && isProtectedRoute) {
          setLoading(false);
          return;
        }

        const storedUserJson = localStorage.getItem('app_user');
        if (!storedUserJson) {
           setLoading(false);
           // Handle protected routes
           const protectedRoutes = ['/painel', '/receitas', '/despesas', '/investimentos', '/orcamento'];
           if (protectedRoutes.some(path => pathname.startsWith(path))) {
             router.push('/');
           }
           return;
        }

        try {
          const parsedUser = JSON.parse(storedUserJson);
          
          // Verify session integrity
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            console.warn('Supabase session error:', sessionError.message);
            // If the refresh token is missing or invalid, we must clear state
            if (
              sessionError.message.includes('Refresh Token Not Found') || 
              sessionError.message.includes('refresh_token_not_found') ||
              sessionError.message.includes('invalid refresh token')
            ) {
              localStorage.removeItem('app_user');
              setUser(null);
              // Ensure Supabase client is also cleared
              await supabase.auth.signOut();
              if (pathname !== '/' && pathname !== '/registrar') {
                router.push('/');
              }
              return;
            }
          }
          
          if (!session) {
            // Try to restore from stored session if available
            if (parsedUser.session?.access_token && parsedUser.session?.refresh_token) {
              const { error: restoreError } = await supabase.auth.setSession({
                access_token: parsedUser.session.access_token,
                refresh_token: parsedUser.session.refresh_token
              });
              
              if (restoreError) {
                console.warn('Could not restore session:', restoreError.message);
                signOut();
                return;
              }
            } else {
              console.warn('No session found in Supabase or storage, signing out');
              signOut();
              return;
            }
          }

          // Verify user in DB to ensure they are still active
          const { data: dbUser, error: dbError } = await supabase
            .from('users')
            .select('*')
            .eq('id', parsedUser.id)
            .single();

          if (dbError || !dbUser || dbUser.status !== 'Active') {
            console.error('User validation failed or user inactive');
            signOut();
            return;
          }

          // Update user state if needed
          setUser(prev => {
            if (prev && prev.id === dbUser.id && prev.status === dbUser.status) return prev;
            return { ...dbUser, session: parsedUser.session };
          });

        } catch (err) {
          console.error('Auth verification error:', err);
          signOut();
        }
      } finally {
        setLoading(false);
        checkingRef.current = false;
      }
    };

    checkUser();
  }, [pathname, router, signOut, user]); // Stabilized dependencies

  useEffect(() => {
    // Listen for auth state changes but avoid state updates that trigger re-runs
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('app_user');
        setUser(null);
        if (pathname !== '/' && pathname !== '/registrar') {
          router.push('/');
        }
      }
      
      if (session && (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
        const stored = localStorage.getItem('app_user');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed.id === session.user.id) {
              parsed.session = {
                access_token: session.access_token,
                refresh_token: session.refresh_token,
                expires_at: session.expires_at,
                expires_in: session.expires_in,
                token_type: session.token_type,
                user: session.user
              };
              localStorage.setItem('app_user', JSON.stringify(parsed, getCircularReplacer()));
            }
          } catch (e) {
            console.error('Error updating refresh token in storage:', e);
          }
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, signOut, updateUser }}>
      <SessionManager />
      {children}
    </AuthContext.Provider>
  );
};
