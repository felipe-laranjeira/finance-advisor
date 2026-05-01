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
      .eq('email', email)
      .single();

    if (dbError || !user) {
      // If user exists in Auth but not in public table, we should create a basic profile
      console.info(`User authenticated but profile missing for ${email}. Creating profile...`);
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authUser.id,
          email: email,
          name: authUser.user_metadata?.name || email.split('@')[0],
          status: 'Ativo'
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Failed to create missing user profile:', createError);
        return NextResponse.json({ error: 'Erro ao sincronizar perfil do usuário' }, { status: 500 });
      }

      return NextResponse.json({
        id: authUser.id,
        name: newUser.name,
        email: newUser.email,
        photo_url: newUser.photo_url,
        status: newUser.status,
        session: authSession 
      });
    }

    // 3. Simple status check
    if (user.status !== 'Ativo') {
      console.warn(`Login blocked: user status is ${user.status} for ${email}`);
      // If sign-in worked but status is inactive, we sign out
      await supabase.auth.signOut();
      return NextResponse.json({ error: 'Sua conta está inativa. Entre em contato com o administrador.' }, { status: 403 });
    }

    // 4. Sync ID if necessary
    if (user.id !== authUser.id) {
       console.info(`Syncing user ID for ${email} from ${user.id} to ${authUser.id}`);
       await supabaseAdmin
         .from('users')
         .update({ id: authUser.id })
         .eq('email', email);
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
