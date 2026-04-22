import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function PATCH(request: Request) {
  try {
    const { userId, currentPassword, newPassword } = await request.json();

    if (!userId || !currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // Fetch user with password_hash
    const { data: user, error } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Verify current password
    const isMatch = bcrypt.compareSync(currentPassword, user.password_hash);
    if (!isMatch) {
      return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 401 });
    }

    // Hash new password
    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(newPassword, salt);

    // Update password in DB
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash, salt })
      .eq('id', userId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ message: 'Senha alterada com sucesso' });

  } catch (error: any) {
    console.error('Change Password API Error:', error);
    return NextResponse.json({ error: 'Erro ao alterar senha' }, { status: 500 });
  }
}
