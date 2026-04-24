-- MIGRATION: RE-ENABLING RLS AND FIXING SECURITY POLICIES
-- This migration re-enables Row Level Security on all tables and implements proper policies.

DO $$ 
BEGIN
    -- 1. Enable RLS on all tables
    ALTER TABLE public.expense_transactions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.investment_transactions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.incoming ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.expense_budgets ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.investment_budgets ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.transactions_categories ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.investiments_categories ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.incoming_categories ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.transactions_category_instruction ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.incoming_category_instruction ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

    -- 2. Setup Policies (Robust RLS matching via auth email)
    -- This allows security even if public.users.id and auth.users.id don't match, 
    -- by verifying the email associated with the current Supabase session.
    
    -- USERS Table
    DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
    CREATE POLICY "Users can view their own data" ON public.users
    FOR SELECT USING (email = (auth.jwt() ->> 'email'));

    DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
    CREATE POLICY "Users can update their own data" ON public.users
    FOR UPDATE USING (email = (auth.jwt() ->> 'email')) WITH CHECK (email = (auth.jwt() ->> 'email'));

    DROP POLICY IF EXISTS "Anyone can insert users during registration" ON public.users;
    CREATE POLICY "Anyone can insert users during registration" ON public.users
    FOR INSERT WITH CHECK (true);

    -- EXPENSE TRANSACTIONS
    DROP POLICY IF EXISTS "Users can manage their own expense transactions" ON public.expense_transactions;
    CREATE POLICY "Users can manage their own expense transactions" 
    ON public.expense_transactions FOR ALL 
    USING (user_id IN (SELECT id FROM public.users WHERE email = (auth.jwt() ->> 'email')))
    WITH CHECK (user_id IN (SELECT id FROM public.users WHERE email = (auth.jwt() ->> 'email')));

    -- INVESTMENT TRANSACTIONS
    DROP POLICY IF EXISTS "Users can manage their own investment transactions" ON public.investment_transactions;
    CREATE POLICY "Users can manage their own investment transactions" 
    ON public.investment_transactions FOR ALL 
    USING (user_id IN (SELECT id FROM public.users WHERE email = (auth.jwt() ->> 'email')))
    WITH CHECK (user_id IN (SELECT id FROM public.users WHERE email = (auth.jwt() ->> 'email')));

    -- INCOMING
    DROP POLICY IF EXISTS "Users can manage their own incoming" ON public.incoming;
    CREATE POLICY "Users can manage their own incoming" 
    ON public.incoming FOR ALL 
    USING (user_id IN (SELECT id FROM public.users WHERE email = (auth.jwt() ->> 'email')))
    WITH CHECK (user_id IN (SELECT id FROM public.users WHERE email = (auth.jwt() ->> 'email')));

    -- BUDGETS
    DROP POLICY IF EXISTS "Users can manage their own expense budgets" ON public.expense_budgets;
    CREATE POLICY "Users can manage their own expense budgets" 
    ON public.expense_budgets FOR ALL 
    USING (user_id IN (SELECT id FROM public.users WHERE email = (auth.jwt() ->> 'email')))
    WITH CHECK (user_id IN (SELECT id FROM public.users WHERE email = (auth.jwt() ->> 'email')));

    DROP POLICY IF EXISTS "Users can manage their own investment budgets" ON public.investment_budgets;
    CREATE POLICY "Users can manage their own investment budgets" 
    ON public.investment_budgets FOR ALL 
    USING (user_id IN (SELECT id FROM public.users WHERE email = (auth.jwt() ->> 'email')))
    WITH CHECK (user_id IN (SELECT id FROM public.users WHERE email = (auth.jwt() ->> 'email')));

    -- CATEGORIES (Public Read, Admin Write via Service Role)
    DROP POLICY IF EXISTS "Public read for transactions_categories" ON public.transactions_categories;
    CREATE POLICY "Public read for transactions_categories" ON public.transactions_categories FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Public read for investiments_categories" ON public.investiments_categories;
    CREATE POLICY "Public read for investiments_categories" ON public.investiments_categories FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Public read for incoming_categories" ON public.incoming_categories;
    CREATE POLICY "Public read for incoming_categories" ON public.incoming_categories FOR SELECT USING (true);

    -- INSTRUCTIONS (Category instructions)
    DROP POLICY IF EXISTS "Users can manage their own transactions instructions" ON public.transactions_category_instruction;
    CREATE POLICY "Users can manage their own transactions instructions" 
    ON public.transactions_category_instruction FOR ALL 
    USING (user_id IN (SELECT id FROM public.users WHERE email = (auth.jwt() ->> 'email')))
    WITH CHECK (user_id IN (SELECT id FROM public.users WHERE email = (auth.jwt() ->> 'email')));

    DROP POLICY IF EXISTS "Users can manage their own incoming instructions" ON public.incoming_category_instruction;
    CREATE POLICY "Users can manage their own incoming instructions" 
    ON public.incoming_category_instruction FOR ALL 
    USING (user_id IN (SELECT id FROM public.users WHERE email = (auth.jwt() ->> 'email')))
    WITH CHECK (user_id IN (SELECT id FROM public.users WHERE email = (auth.jwt() ->> 'email')));

    -- INVESTMENTS Table
    DROP POLICY IF EXISTS "Users can manage their own investments" ON public.investments;
    CREATE POLICY "Users can manage their own investments"
    ON public.investments FOR ALL 
    USING (user_id IN (SELECT id FROM public.users WHERE email = (auth.jwt() ->> 'email')))
    WITH CHECK (user_id IN (SELECT id FROM public.users WHERE email = (auth.jwt() ->> 'email')));

END $$;
