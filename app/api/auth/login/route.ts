import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { email: rawEmail, password } = await request.json();
    const email = rawEmail?.toLowerCase();

    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios' }, { status: 400 });
    }

    // Fetch user from custom table using ADMIN client (to bypass RLS during login)
    const { data: user, error } = await supabaseAdmin
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

    // --- START AUTH SYNC: Ensure Supabase Auth session for RLS ---
    let session = null;
    try {
      // 1. Try to sign in with standard client
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.info(`Supabase Auth sign-in failed (${authError.message}), checking if user needs creation...`);
        
        // 2. If fails, try to ensure user exists in auth.users using admin client
        // We use the SAME password as provided (which passed bcrypt check)
        const { data: adminUser, error: adminError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name: user.name }
        });

        if (adminError) {
          if (adminError.message.includes('already registered')) {
             // User exists but password might be different. Sync it.
             // Try to get user metadata directly if possible or search in list
             const { data: { users: authUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
               perPage: 1000 // Increase to find the user
             });
             
             if (listError) throw listError;

             const authUser = authUsers.find(u => u.email?.toLowerCase() === email.toLowerCase());
             if (authUser) {
               // Update password and ensure email is confirmed
               await supabaseAdmin.auth.admin.updateUserById(authUser.id, { 
                 password,
                 email_confirm: true 
               });
             }
          } else {
            console.error('Failed to create/sync auth user:', adminError);
          }
        }

        // 3. Try sign in again after sync
        const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (!retryError) {
          session = retryData.session;
        } else {
          console.error('Final Supabase Auth sync failed:', retryError);
        }
      } else {
        session = authData.session;
      }
    } catch (authSyncErr) {
      console.error('Critical Error during Auth Sync:', authSyncErr);
    }
    // --- END AUTH SYNC ---

    // Check status and auto-activate to unblock
    if (user.status !== 'Active') {
      console.info(`Auto-activating user account for ${email}`);
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ status: 'Active' })
        .eq('id', user.id);
      
      if (!updateError) {
        user.status = 'Active';
      }
    }

    // Return user data (session will be managed client-side in localStorage for simplicity in this app)
    // Note: To truly secure RLS, the app should also sign in to Supabase Auth.
    // For now, we return the user data and the client uses it.
    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      photo_url: user.photo_url,
      status: user.status,
      session: session // Include the synced Supabase session
    });

  } catch (error: any) {
    console.error('Login API Error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
