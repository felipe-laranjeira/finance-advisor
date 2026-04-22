import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { name, email: rawEmail, password } = await request.json();
    const email = rawEmail?.toLowerCase();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
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

    // Create user in manual table
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          name,
          email,
          password_hash,
          salt,
          status: 'Inactive', // Required by prompt
        }
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ 
      message: 'Conta criada com sucesso! Aguarde a ativação pelo administrador.',
      user: {
        id: data.id,
        name: data.name,
        email: data.email,
        status: data.status
      }
    });

  } catch (error: any) {
    console.error('Registration API Error:', error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
