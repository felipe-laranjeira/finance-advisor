import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { name, email: rawEmail, password } = await request.json();
    const email = rawEmail?.toLowerCase();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 });
    }

    // Check if user already exists using ADMIN client
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json({ error: 'Este e-mail já está em uso' }, { status: 400 });
    }

    // --- START AUTH SYNC: Create Supabase Auth user FIRST to get the ID ---
    let authUserId = null;
    try {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name }
      });
      
      if (authError) {
        if (authError.message.includes('already registered') || authError.message.includes('unique_email')) {
          return NextResponse.json({ error: 'Este e-mail já está em uso' }, { status: 400 });
        }
        throw authError;
      }
      authUserId = authData.user.id;
    } catch (authErr: any) {
      console.error('Auth Sync error during registration:', authErr);
      return NextResponse.json({ error: 'Erro ao criar conta de autenticação.' }, { status: 500 });
    }
    // --- END AUTH SYNC ---

    // Create user in manual table using FIXED ID from auth.users
    const { data: publicUser, error: publicError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          id: authUserId,
          name,
          email,
          status: 'Ativo', // Status padrão como Ativo para simplificar
        }
      ])
      .select()
      .single();

    if (publicError) {
      // Cleanup if failed
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      console.error('Database Sync error:', publicError);
      return NextResponse.json({ error: 'Erro ao criar perfil do usuário no banco de dados.' }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Conta criada com sucesso!',
      user: {
        id: publicUser.id,
        name: publicUser.name,
        email: publicUser.email,
        status: publicUser.status
      }
    });

  } catch (error: any) {
    console.error('Registration API Error:', error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
