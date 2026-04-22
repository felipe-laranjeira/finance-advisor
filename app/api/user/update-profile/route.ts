import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function PATCH(request: Request) {
  try {
    const { userId, name, email, currentPassword } = await request.json();

    if (!userId || !currentPassword) {
      return NextResponse.json({ error: 'Usuário e senha atual são obrigatórios' }, { status: 400 });
    }

    // Verify current password first
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const isMatch = bcrypt.compareSync(currentPassword, user.password_hash);
    if (!isMatch) {
      return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 401 });
    }

    if (!name && !email) {
      return NextResponse.json({ error: 'Nenhum dado para atualizar' }, { status: 400 });
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase();

    // If email is changing, check if it's already in use
    if (email) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase())
        .neq('id', userId)
        .single();

      if (existingUser) {
        return NextResponse.json({ error: 'Este e-mail já está em uso por outro usuário' }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      message: 'Perfil atualizado com sucesso',
      user: {
        id: data.id,
        name: data.name,
        email: data.email,
        photo_url: data.photo_url,
        status: data.status
      }
    });

  } catch (error: any) {
    console.error('Update Profile API Error:', error);
    return NextResponse.json({ error: 'Erro ao atualizar perfil' }, { status: 500 });
  }
}
