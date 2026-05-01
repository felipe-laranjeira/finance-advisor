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
    // We try by ID (preferred) but provide more context if it fails
    const { data: user, error: dbError } = await supabaseAdmin
      .from('users')
      .select('id, name, email, status, photo_url')
      .eq('id', authUser.id)
      .single();

    if (dbError || !user) {
      // Diagnostic check: is the service role key missing or RLS blocking?
      const isUsingAnonKey = process.env.SUPABASE_SERVICE_ROLE_KEY ? false : true;
      
      console.error(`Login profiles search failed for UUID: ${authUser.id}`, { 
        error: dbError?.message, 
        code: dbError?.code,
        details: dbError?.details,
        usingAnonKeyFallback: isUsingAnonKey
      });

      await supabase.auth.signOut();
      
      const errorMsg = isUsingAnonKey 
        ? 'Erro interno: SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.'
        : 'Perfil de usuário não encontrado no banco de dados. Verifique a sincronização.';
        
      return NextResponse.json({ error: errorMsg }, { status: 401 });
    }

    // 3. Strict status check (REGRA 1 e 2)
    // Accept both lowercase 'status' or uppercase 'Status' in case of schema drift
    const userStatus = (user as any).status || (user as any).Status;
    
    if (userStatus !== 'Ativo') {
      await supabase.auth.signOut();
      return NextResponse.json({ error: 'Sua conta aguarda ativação pelo administrador.' }, { status: 403 });
    }

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
