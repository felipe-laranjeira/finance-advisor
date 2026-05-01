import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export async function PATCH(request: Request) {
  try {
    const { userId, name, email } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório' }, { status: 400 });
    }

    if (!name && !email) {
      return NextResponse.json({ error: 'Nenhum dado para atualizar' }, { status: 400 });
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase();

    // If email is changing, we should also update it in Supabase Auth
    if (email) {
       const { error: authEmailError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
         email: email.toLowerCase()
       });
       if (authEmailError) {
         console.error('Failed to update email in Supabase Auth:', authEmailError);
         return NextResponse.json({ error: 'Erro ao atualizar e-mail na autenticação: ' + authEmailError.message }, { status: 400 });
       }
    }

    const { data: updatedUser, error: dbError } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (dbError) {
      console.error('Database update error:', dbError);
      throw dbError;
    }

    return NextResponse.json({
      message: 'Perfil atualizado com sucesso',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        photo_url: updatedUser.photo_url,
        status: updatedUser.status
      }
    });

  } catch (error: any) {
    console.error('Update Profile API Error:', error);
    return NextResponse.json({ error: 'Erro ao atualizar perfil' }, { status: 500 });
  }
}
