import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { email: rawEmail, password } = await request.json();
    const email = rawEmail?.toLowerCase();

    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios' }, { status: 400 });
    }

    // 1. Authenticate with Supabase Auth (Single source of truth)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.warn(`Supabase Auth sign-in failed for ${email}: ${authError.message}`);
      return NextResponse.json({ error: 'Credenciais inválidas ou erro no servidor' }, { status: 401 });
    }

    const authSession = authData.session;
    const authUser = authData.user;

    // 2. Fetch user profile from public table
    const { data: user, error: dbError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authUser.id) // Busca estrita pelo ID do Auth
      .single();

    if (dbError || !user) {
      console.error(`Login profiles search failed for UUID: ${authUser.id}`, { 
        error: dbError?.message, 
        code: dbError?.code,
        details: dbError?.details
      });
      await supabase.auth.signOut();
      return NextResponse.json({ error: 'Perfil de usuário não encontrado ou erro de sincronização.' }, { status: 401 });
    }

    // 3. Strict status check (REGRA 1 e 2)
    if (user.status !== 'Ativo') {
      await supabase.auth.signOut();
      return NextResponse.json({ error: 'Sua conta aguarda ativação pelo administrador.' }, { status: 403 });
    }

    return NextResponse.json({
      id: authUser.id,
      name: user.name,
      email: user.email,
      photo_url: user.photo_url,
      status: user.status,
      session: authSession 
    });

  } catch (error: any) {
    console.error('Login API Error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
