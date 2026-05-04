'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
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

  useEffect(() => {
    // LOGS DE AMBIENTE (TAREFA 4)
    console.log('APP_INIT:', process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 10));
  }, []);

  // TRATAMENTO DE QUERY STRING (TAREFA 3)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('redirectedFrom=')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('redirectedFrom');
      window.history.replaceState({}, '', url.toString());
    }
  }, [pathname]);

  const signOut = useCallback(async () => {
    try {
      localStorage.removeItem('app_user');
      setUser(null);
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      if (window.location.pathname !== '/') {
        router.replace('/');
      }
    }
  }, [router]);

  // Função de Login centralizada (Memoizada)
  const login = useCallback(async (userData: AppUser) => {
    if (checkingRef.current) return; // Evita múltiplas chamadas simultâneas
    
    console.log('[Auth] Iniciando processo de login no cliente...');
    setLoading(true);
    checkingRef.current = true; // Bloqueia checkUser durante o processo de login
    
    try {
      if (!userData || !userData.id) {
        throw new Error('Dados de usuário inválidos recebidos do servidor.');
      }

      // 1. Sincronização de Sessão Supabase
      if (userData.session?.access_token) {
        console.log('[Auth] Sincronizando sessão Supabase...');
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: userData.session.access_token,
          refresh_token: userData.session.refresh_token
        });
        
        if (sessionError) {
          console.error('[Auth] Erro ao sincronizar sessão:', sessionError.message);
          throw new Error(`Erro na segurança: ${sessionError.message}`);
        }
        
        const { data: { session: verifiedSession } } = await supabase.auth.getSession();
        if (!verifiedSession) {
          console.warn('[Auth] Alerta: Sessão não detectada pelo Supabase após setSession.');
        } else {
          console.info('[Auth] Sessão Supabase verificada e ativa.');
        }
      }

      // 2. Persistência de estado local para hidratação rápida
      const userToStore = { ...userData };
      localStorage.setItem('app_user', JSON.stringify(userToStore, getCircularReplacer()));
      
      setUser(userData);
      
      // 3. Navegação
      console.log('[Auth] Login completo. Redirecionando para /painel');
      router.replace('/painel');
      
    } catch (err: any) {
      console.error('[Auth] Erro fatal no login:', err);
      setLoading(false);
      checkingRef.current = false; // Libera no erro
      
      if (err.message?.includes('pattern') || err.name === 'InvalidCharacterError') {
        localStorage.clear(); 
        throw new Error('Erro de segurança (tokens inválidos). O cache foi limpo, tente novamente.');
      }
      throw err;
    } finally {
      // Nota: Não desligamos o checkingRef aqui imediatamente para permitir 
      // que a navegação aconteça sem interferência do checkUser inicial do novo pathname
      setTimeout(() => {
        checkingRef.current = false;
      }, 2000);
    }
  }, [router]);

  // Função para atualizar perfil do usuário em memória e cache
  const updateUser = useCallback((userData: Partial<AppUser>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...userData };
      try {
        localStorage.setItem('app_user', JSON.stringify(updated, getCircularReplacer()));
      } catch (e) {
        console.error('[Auth] Erro ao atualizar cache local:', e);
      }
      return updated;
    });
  }, []);

  // Efeito principal de verificação de autenticação (CheckUser)
  useEffect(() => {
    const checkUser = async () => {
      if (checkingRef.current) return;
      
      try {
        checkingRef.current = true;
        const isProtectedRoute = pathname !== '/' && pathname !== '/registrar';
        
        // 1. Hidratação rápida via Cache Local (Melhora UX inicial)
        const storedUserJson = localStorage.getItem('app_user');
        let localUser: any = null;
        if (storedUserJson && storedUserJson !== 'undefined' && storedUserJson !== 'null') {
          try {
            localUser = JSON.parse(storedUserJson);
            if (!user) setUser(localUser);
          } catch (e) {
            console.error('[Auth] Falha no parse do cache:', e);
          }
        }

        // 2. Validação Real com Supabase Auth
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[Auth] Erro ao buscar sessão Supabase:', sessionError.message);
        }
        
        // Caso não haja sessão ativa no Supabase
        if (!session) {
          console.info('[Auth] Nenhuma sessão ativa no Supabase.');
          
          // Tentativa de restauração emergencial se tivermos tokens no cache local
          if (localUser?.session?.access_token) {
            console.log('[Auth] Tentando restaurar sessão via cache local...');
            try {
              const { error: restoreError } = await supabase.auth.setSession({
                access_token: localUser.session.access_token,
                refresh_token: localUser.session.refresh_token
              });
              
              if (!restoreError) {
                const { data: { session: newSession } } = await supabase.auth.getSession();
                if (newSession) {
                  console.log('[Auth] Sessão restaurada com sucesso.');
                  await handleSession(newSession, localUser);
                  return;
                }
              }
            } catch (e) {
              console.error('[Auth] Erro ao tentar restaurar sessão:', e);
            }
          }

          // Se chegarmos aqui e for rota protegida sem sessão: Expulsa para login
          if (isProtectedRoute) {
            console.warn('[Auth] Acesso negado: Rota protegida sem sessão ativa.');
            setUser(null);
            localStorage.removeItem('app_user');
            router.replace('/');
          }
          setLoading(false);
          return;
        }

        // Se houver sessão, validamos o perfil no banco (Regras de Negócio: Ativo/Inativo)
        await handleSession(session, localUser);

      } catch (err: any) {
        console.error('[Auth] Erro crítico no fluxo de autenticação:', err.message);
        // Proteção contra looping infinito por tokens inválidos
        if (err.message?.includes('pattern') || err.name === 'InvalidCharacterError') {
          localStorage.clear();
          await signOut();
        }
      } finally {
        setLoading(false);
        checkingRef.current = false;
      }
    };

    // Sub-rotina para processar a sessão e validar perfil
    const handleSession = async (activeSession: any, localUser: any) => {
      const userId = activeSession.user.id;
      
      // Busca dados do perfil no banco (Ponto de verdade para Status)
      let dbUser = null;
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, name, email, status, photo_url')
          .eq('id', userId)
          .maybeSingle();
          
        if (!error && data) {
          dbUser = data;
        } else if (error) {
          console.warn('[Auth] Erro DB, usando cache se compatível:', error.message);
        }
      } catch (e) {
        console.warn('[Auth] Sem conexão com banco de dados.');
      }

      // Fallback para cache local se o banco falhar mas o ID coincidir
      if (!dbUser && localUser && localUser.id === userId) {
        dbUser = localUser;
      }

      // Auto-reparo (Self-healing): cria o perfil na public.users se o Auth for válido mas o registro faltar
      if (!dbUser) {
        console.log('[Auth] Perfil não encontrado no banco. Criando registro...');
        const { data: newUser } = await supabase.from('users').upsert({
          id: userId,
          email: activeSession.user.email,
          name: activeSession.user.user_metadata?.name || activeSession.user.email?.split('@')[0] || 'Usuário',
          status: 'Ativo'
        }).select().single();
        dbUser = newUser;
      }

      const statusAtual = dbUser?.status || (dbUser as any)?.Status || 'Ativo';

      // Validação de Conta Bloqueada
      if (statusAtual === 'Inativo') {
        console.error('[Auth] Acesso negado: Conta inativa.');
        await signOut();
        return;
      }

      // Sucesso: Sincroniza estado e cache
      const finalUser = { ...dbUser, status: statusAtual, session: activeSession };
      setUser(finalUser);
      localStorage.setItem('app_user', JSON.stringify(finalUser, getCircularReplacer()));

      // Redirecionamento amigável para quem está na Home mas já logado
      if (pathname === '/' && statusAtual === 'Ativo') {
        router.replace('/painel');
      }
    };

    checkUser();
  }, [pathname, router, signOut]);


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
        if (stored && stored !== 'undefined') {
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
      {children}
    </AuthContext.Provider>
  );
};
