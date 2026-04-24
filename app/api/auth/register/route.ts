import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

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

    // Hash password
    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);

    // --- START AUTH SYNC: Create Supabase Auth user FIRST to get the ID ---
    let authUserId = null;
    try {
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name }
      });
      
      if (authError) {
        if (authError.message.includes('already registered')) {
          // If already exists, we might need to find it, but for registration this is an error
          return NextResponse.json({ error: 'Este e-mail já está em uso' }, { status: 400 });
        }
        throw authError;
      }
      authUserId = authUser.user.id;
    } catch (authErr: any) {
      console.error('Auth Sync error during registration:', authErr);
      return NextResponse.json({ error: 'Erro ao sincronizar autenticação: ' + authErr.message }, { status: 500 });
    }
    // --- END AUTH SYNC ---

    // Create user in manual table using FIXED ID from auth.users
    const { data: publicUser, error: publicError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          id: authUserId, // Use the same ID
          name,
          email,
          password_hash,
          salt,
          status: 'Inactive',
        }
      ])
      .select()
      .single();

    if (publicError) {
      // Cleanup if failed
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      throw publicError;
    }

    return NextResponse.json({ 
      message: 'Conta criada com sucesso! Aguarde a ativação pelo administrador.',
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
