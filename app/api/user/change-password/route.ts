import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PATCH(request: Request) {
  try {
    const { userId, currentPassword, newPassword } = await request.json();

    if (!userId || !newPassword) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // Use Supabase Auth to update the password. 
    // Note: If using standard client, it requires a session. 
    // If using admin client, it doesn't need the session.
    const { error: updateError } = await supabase.auth.updateUser({ 
      password: newPassword 
    });

    if (updateError) {
      console.error('Auth password update error:', updateError);
      return NextResponse.json({ error: 'Erro ao alterar senha na autenticação: ' + updateError.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Senha alterada com sucesso' });

  } catch (error: any) {
    console.error('Change Password API Error:', error);
    return NextResponse.json({ error: 'Erro ao alterar senha' }, { status: 500 });
  }
}
