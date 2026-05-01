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
  status: 'Ativo' | 'Inativo';
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

  const [showInactivityModal, setShowInactivityModal] = useState(false);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Define signOut and login early to avoid TDZ issues with resetTimers
  const signOut = useCallback(async () => {
    try {
      setShowInactivityModal(false);
      localStorage.removeItem('app_user');
      setUser(null);
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      if (window.location.pathname !== '/') {
        router.push('/');
      }
    }
  }, [router]);

  const resetTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);

    if (!user) return;

    // 28 minutes warning (REGRA 3.1)
    warningTimerRef.current = setTimeout(() => {
      setShowInactivityModal(true);
    }, 28 * 60 * 1000);

    // 30 minutes absolute logout (REGRA 3.1)
    inactivityTimerRef.current = setTimeout(() => {
      signOut();
    }, 30 * 60 * 1000);
  }, [user, signOut]);

  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    const handleActivity = () => {
      if (showInactivityModal) return;
      resetTimers();
    };

    events.forEach(event => window.addEventListener(event, handleActivity));
    resetTimers();

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [user, resetTimers, showInactivityModal]);

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
        // Check if we already have a user in state
        const isProtectedRoute = pathname !== '/' && pathname !== '/registrar';
        
        const storedUserJson = localStorage.getItem('app_user');
        if (!storedUserJson) {
           setUser(null);
           setLoading(false);
           if (isProtectedRoute) {
             router.push('/');
           }
           return;
        }

        try {
          const parsedUser = JSON.parse(storedUserJson);
          
          // Verify session integrity with Supabase
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            console.warn('Supabase session error:', sessionError.message);
            if (sessionError.message.includes('refresh_token_not_found') || sessionError.message.includes('Refresh Token Not Found')) {
              signOut();
              return;
            }
          }
          
          if (!session) {
            // No Supabase session, but we have a stored user? Try to sync.
            if (parsedUser.session?.access_token) {
               const { error: restoreError } = await supabase.auth.setSession({
                 access_token: parsedUser.session.access_token,
                 refresh_token: parsedUser.session.refresh_token
               });
               if (restoreError) {
                 signOut();
                 return;
               }
            } else {
               signOut();
               return;
            }
          }

          const userId = session?.user?.id || parsedUser.id;

          // Optimization: If user already set and ID matches, don't re-render/re-fetch unless necessary
          if (user && user.id === userId) {
            setLoading(false);
            if (pathname === '/') router.push('/painel');
            return;
          }

          // Verify user in DB (RLS check)
          const { data: dbUser, error: dbError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

          if (dbError || !dbUser) {
            console.warn('RLS check failed or user not in DB, but session exists. Using stored profile fallback.');
            const correctedUser = { ...parsedUser, id: userId };
            setUser(correctedUser);
            localStorage.setItem('app_user', JSON.stringify(correctedUser, getCircularReplacer()));
            setLoading(false);
            if (pathname === '/') router.push('/painel');
            return;
          }

          if (dbUser.status !== 'Ativo') {
            console.error('Account inactive. Status:', dbUser.status);
            localStorage.removeItem('app_user');
            setUser(null);
            await signOut();
            return;
          }

          const finalUser = { ...dbUser, session: session || parsedUser.session };
          setUser(finalUser);
          localStorage.setItem('app_user', JSON.stringify(finalUser, getCircularReplacer()));

          // Redirect if at login page
          if (pathname === '/') {
            router.push('/painel');
          }

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
  }, [pathname, router, signOut]); // Removed 'user' from dependencies to avoid loop

  useEffect(() => {
    // Synchronize logout across tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'app_user' && e.newValue === null) {
        console.info('Logout detectado em outra aba. Sincronizando...');
        setUser(null);
        if (pathname !== '/' && pathname !== '/registrar') {
          router.push('/');
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [pathname, router]);

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
      {showInactivityModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full mx-4 border border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Você ainda está aí?</h3>
            <p className="text-gray-600 mb-6">Sua sessão irá expirar em breve por inatividade. Deseja continuar conectado?</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  setShowInactivityModal(false);
                  resetTimers();
                }}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                id="continue-session-btn"
              >
                Sim, continuar
              </button>
              <button 
                onClick={signOut}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                id="logout-session-btn"
              >
                Sair agora
              </button>
            </div>
          </div>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
};
