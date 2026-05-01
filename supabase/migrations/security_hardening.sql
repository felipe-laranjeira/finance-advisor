-- SQL Refactoring Script (Final Version)
-- Optimized for exact tables identified in the project screenshot

-- 1. CLEANUP AND SCHEMA FIXES (users table)
DO $$ 
BEGIN
    -- Remove old manual auth columns that are now handled by Supabase Auth
    ALTER TABLE public.users DROP COLUMN IF EXISTS password_hash;
    ALTER TABLE public.users DROP COLUMN IF EXISTS salt;
    
    -- Update status constraint to Portuguese
    ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check;
    ALTER TABLE public.users ADD CONSTRAINT users_status_check CHECK (status IN ('Ativo', 'Inativo'));
    
    -- Set default status to Inativo (REGRA 1)
    ALTER TABLE public.users ALTER COLUMN status SET DEFAULT 'Inativo';

    -- Ensure id column is UUID (it should be, but let's be sure)
    -- This might be tricky if it's already PK. Assuming it's already UUID/TEXT.
END $$;

-- 2. ENABLE RLS ON ALL TABLES
-- Financial Tables
ALTER TABLE public.expense_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incoming ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Category Tables
ALTER TABLE public.incoming_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incoming_category_instruction ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investiments_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions_category_instruction ENABLE ROW LEVEL SECURITY;

-- 3. DROP EXISTING POLICIES (Cleanup)
DO $$ 
DECLARE
    t text;
    p text;
BEGIN
    FOR t IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
    LOOP
        FOR p IN 
            SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p, t);
        END LOOP;
    END LOOP;
END $$;

-- 4. CREATE POLICIES (REGRA 2)

-- Unified Policy for Financial Data (CRUD own data)
DO $$ 
DECLARE
    t text;
    financial_tables text[] := ARRAY['expense_budgets', 'expense_transactions', 'incoming', 'investment_budgets', 'investments'];
BEGIN
    FOREACH t IN ARRAY financial_tables LOOP
        EXECUTE format('CREATE POLICY "user_crud_own_data" ON public.%I FOR ALL TO authenticated USING (user_id::text = auth.uid()::text) WITH CHECK (user_id::text = auth.uid()::text)', t);
    END LOOP;
END $$;

-- Policies for users table
CREATE POLICY "user_view_self" ON public.users FOR SELECT TO authenticated USING (id::text = auth.uid()::text);
CREATE POLICY "user_update_self" ON public.users FOR UPDATE TO authenticated USING (id::text = auth.uid()::text) WITH CHECK (id::text = auth.uid()::text);
-- Administration registration creates the record via service_role, but for completeness (though service role bypasses RLS):
CREATE POLICY "allow_registration_insert" ON public.users FOR INSERT WITH CHECK (true);

-- Public Read for Categories (REGRA 2.2)
DO $$ 
DECLARE
    t text;
    category_tables text[] := ARRAY['incoming_categories', 'incoming_category_instruction', 'investiments_categories', 'transactions_categories', 'transactions_category_instruction'];
BEGIN
    FOREACH t IN ARRAY category_tables LOOP
        EXECUTE format('CREATE POLICY "public_read_categories" ON public.%I FOR SELECT TO authenticated, anon USING (true)', t);
        EXECUTE format('CREATE POLICY "no_write_categories" ON public.%I FOR ALL TO authenticated, anon USING (false) WITH CHECK (false)', t);
    END LOOP;
END $$;

-- 5. ENSURE AT LEAST ONE ACTIVE USER FOR TESTING
-- This updates existing users to Ativo if they are not already, OR we can leave them Inativo and the admin must activate.
-- As per Rule 1, new users are Inativo. Let's make existing ones Ativo for ease of use if they exist.
-- UPDATE public.users SET status = 'Ativo';
