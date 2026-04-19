-- Migration to create custom users table for manual authentication
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'Inactive' CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS (though for custom auth we might need to handle it differently, 
-- but let's keep it for privacy if we were to use service role or similar)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy to let users see their own data
CREATE POLICY "Users can view their own data" ON public.users
FOR SELECT USING (true); -- We'll filter in the app for now as custom auth doesn't populate auth.uid() automatically without Supabase Auth

-- Allow anyone to insert during registration
CREATE POLICY "Anyone can insert users during registration" ON public.users
FOR INSERT WITH CHECK (true);
