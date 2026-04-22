import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { email: rawEmail, password } = await request.json();
    const email = rawEmail?.toLowerCase();

    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios' }, { status: 400 });
    }

    // Fetch user from custom table
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      console.warn(`Login attempt failed: user not found (${email})`, error);
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    // Verify password
    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      console.warn(`Login attempt failed: password mismatch for ${email}`);
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    // Check status and auto-activate to unblock
    if (user.status !== 'Active') {
      console.info(`Auto-activating user account for ${email}`);
      const { error: updateError } = await supabase
        .from('users')
        .update({ status: 'Active' })
        .eq('id', user.id);
      
      if (!updateError) {
        user.status = 'Active';
      }
    }

    // Return user data (session will be managed client-side in localStorage for simplicity in this replacement)
    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      photo_url: user.photo_url,
      status: user.status
    });

  } catch (error: any) {
    console.error('Login API Error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
