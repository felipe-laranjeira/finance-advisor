import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { email: rawEmail, password } = await request.json();
    const email = rawEmail?.toLowerCase();

    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios' }, { status: 400 });
    }

    console.log(`[LoginAPI] Iniciando autenticação para email: ${email}`);

    // 1. Authenticate with Supabase Auth (Single source of truth)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.warn(`[LoginAPI] Erro Supabase Auth para ${email}: ${authError.message}`);
      return NextResponse.json({ error: 'Credenciais inválidas ou erro no servidor' }, { status: 401 });
    }

    console.log(`[LoginAPI] Usuário autenticado no Supabase Auth. ID: ${authData.user.id}`);
    const authSession = authData.session;
    const authUser = authData.user;

    // 2. Fetch user profile from public table
    console.log(`[LoginAPI] Buscando perfil do usuário na tabela public.users para ID: ${authUser.id}`);
    let { data: user, error: dbError } = await supabaseAdmin
      .from('users')
      .select('id, name, email, status, photo_url')
      .eq('id', authUser.id)
      .single();

    if (dbError || !user) {
      console.warn(`[LoginAPI] Perfil não encontrado para ${authUser.id}. Criando perfil automático...`);
      
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .upsert({
          id: authUser.id,
          email: authUser.email,
          name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Usuário',
          status: 'Ativo',
          photo_url: authUser.user_metadata?.avatar_url || null
        })
        .select('id, name, email, status, photo_url')
        .single();

      if (createError || !newUser) {
        console.error(`[LoginAPI] Falha ao criar perfil automático para UUID: ${authUser.id}`, createError?.message);
        const isUsingAnonKey = !process.env.SUPABASE_SERVICE_ROLE_KEY;
        await supabase.auth.signOut();
        const errorMsg = isUsingAnonKey 
          ? 'Erro interno: SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.'
          : 'Falha ao sincronizar perfil de usuário no banco de dados.';
        return NextResponse.json({ error: errorMsg }, { status: 401 });
      }
      
      user = newUser;
      console.log('[LoginAPI] Perfil automático criado com sucesso.');
    }

    console.log(`[LoginAPI] Perfil encontrado. Status atual: ${user.status || (user as any).Status}`);

    // 3. Strict status check (REGRA 1 e 2)
    const userStatus = (user as any).status || (user as any).Status;
    
    if (userStatus !== 'Ativo') {
      console.warn(`[LoginAPI] Tentativa de login bloqueada para status: ${userStatus}`);
      await supabase.auth.signOut();
      return NextResponse.json({ error: 'Sua conta aguarda ativação pelo administrador.' }, { status: 403 });
    }

    console.log('[LoginAPI] Login autorizado com sucesso.');

    return NextResponse.json({
      id: authUser.id,
      name: user.name,
      email: user.email,
      photo_url: user.photo_url,
      status: userStatus,
      session: authSession 
    });

  } catch (error: any) {
    console.error('Login API Error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
