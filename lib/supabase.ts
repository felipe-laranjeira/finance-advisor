import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Standard client for browser or basic server usage.
 * In a browser, it uses createBrowserClient for cookie management.
 * On the server, it uses the standard createClient to avoid SSR initialization errors.
 */
export const supabase = typeof window !== 'undefined'
  ? createBrowserClient(supabaseUrl, supabaseAnonKey)
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });

// Admin client for server-side operations that bypass RLS
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
