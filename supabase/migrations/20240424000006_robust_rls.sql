-- MIGRATION: ROBUST RLS OVERHAUL
-- This migration implements a robust ownership check that works with both
-- standard Supabase Auth and our custom ID systems via email matching.

DO $$ 
BEGIN
    -- 1. Create the ownership helper function
    CREATE OR REPLACE FUNCTION public.is_owner(user_id_to_check uuid)
    RETURNS boolean AS $inner$
    DECLARE
      jwt_email text;
    BEGIN
      -- Extract email from JWT
      jwt_email := auth.jwt() ->> 'email';
      
      -- Case 1: Direct UID match (Fastest)
      IF auth.uid() = user_id_to_check THEN
        RETURN true;
      END IF;

      -- Case 2: Email fallback (For legacy/unsynced users)
      IF jwt_email IS NOT NULL THEN
        RETURN EXISTS (
          SELECT 1 FROM public.users 
          WHERE id = user_id_to_check 
          AND lower(email) = lower(jwt_email)
        );
      END IF;

      RETURN false;
    END;
    $inner$ LANGUAGE plpgsql SECURITY DEFINER;

    -- 2. Enable RLS on ALL application tables
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
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
    ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

    -- 3. Clear existing policies to avoid conflicts
    -- USERS
    DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
    DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
    DROP POLICY IF EXISTS "Anyone can insert users during registration" ON public.users;
    
    -- TRANSACTIONS
    DROP POLICY IF EXISTS "Users can manage their own expense transactions" ON public.expense_transactions;
    DROP POLICY IF EXISTS "Users can manage their own investment transactions" ON public.investment_transactions;
    DROP POLICY IF EXISTS "Users can manage their own incoming" ON public.incoming;
    
    -- BUDGETS
    DROP POLICY IF EXISTS "Users can manage their own expense budgets" ON public.expense_budgets;
    DROP POLICY IF EXISTS "Users can manage their own investment budgets" ON public.investment_budgets;
    
    -- CATEGORIES (Static)
    DROP POLICY IF EXISTS "Public read for transactions_categories" ON public.transactions_categories;
    DROP POLICY IF EXISTS "Public read for investiments_categories" ON public.investiments_categories;
    DROP POLICY IF EXISTS "Public read for incoming_categories" ON public.incoming_categories;
    
    -- INSTRUCTIONS
    DROP POLICY IF EXISTS "Users can manage their own transactions instructions" ON public.transactions_category_instruction;
    DROP POLICY IF EXISTS "Users can manage their own incoming instructions" ON public.incoming_category_instruction;
    
    -- INVESTMENTS
    DROP POLICY IF EXISTS "Users can manage their own investments" ON public.investments;

    -- 4. Create New Robust Policies
    
    -- USERS
    CREATE POLICY "Users can manage their own profile" ON public.users
    FOR ALL USING (lower(email) = lower(auth.jwt() ->> 'email'))
    WITH CHECK (lower(email) = lower(auth.jwt() ->> 'email'));

    CREATE POLICY "Public registration" ON public.users
    FOR INSERT WITH CHECK (true);

    -- TRANSACTIONS
    CREATE POLICY "Expense transactions ownership" ON public.expense_transactions
    FOR ALL USING (
      user_id = auth.uid() OR 
      user_id IN (SELECT id FROM public.users WHERE lower(email) = lower(auth.jwt() ->> 'email'))
    )
    WITH CHECK (
      user_id = auth.uid() OR 
      user_id IN (SELECT id FROM public.users WHERE lower(email) = lower(auth.jwt() ->> 'email'))
    );

    CREATE POLICY "Investment transactions ownership" ON public.investment_transactions
    FOR ALL USING (
      user_id = auth.uid() OR 
      user_id IN (SELECT id FROM public.users WHERE lower(email) = lower(auth.jwt() ->> 'email'))
    )
    WITH CHECK (
      user_id = auth.uid() OR 
      user_id IN (SELECT id FROM public.users WHERE lower(email) = lower(auth.jwt() ->> 'email'))
    );

    CREATE POLICY "Incoming ownership" ON public.incoming
    FOR ALL USING (
      user_id = auth.uid() OR 
      user_id IN (SELECT id FROM public.users WHERE lower(email) = lower(auth.jwt() ->> 'email'))
    )
    WITH CHECK (
      user_id = auth.uid() OR 
      user_id IN (SELECT id FROM public.users WHERE lower(email) = lower(auth.jwt() ->> 'email'))
    );

    -- BUDGETS
    CREATE POLICY "Expense budget ownership" ON public.expense_budgets
    FOR ALL USING (
      user_id = auth.uid() OR 
      user_id IN (SELECT id FROM public.users WHERE lower(email) = lower(auth.jwt() ->> 'email'))
    )
    WITH CHECK (
      user_id = auth.uid() OR 
      user_id IN (SELECT id FROM public.users WHERE lower(email) = lower(auth.jwt() ->> 'email'))
    );

    CREATE POLICY "Investment budget ownership" ON public.investment_budgets
    FOR ALL USING (
      user_id = auth.uid() OR 
      user_id IN (SELECT id FROM public.users WHERE lower(email) = lower(auth.jwt() ->> 'email'))
    )
    WITH CHECK (
      user_id = auth.uid() OR 
      user_id IN (SELECT id FROM public.users WHERE lower(email) = lower(auth.jwt() ->> 'email'))
    );

    -- CATEGORIES
    CREATE POLICY "Categories are publicly readable" ON public.transactions_categories FOR SELECT USING (true);
    CREATE POLICY "Investment categories are publicly readable" ON public.investiments_categories FOR SELECT USING (true);
    CREATE POLICY "Incoming categories are publicly readable" ON public.incoming_categories FOR SELECT USING (true);

    -- INSTRUCTIONS
    CREATE POLICY "Transaction instructions ownership" ON public.transactions_category_instruction
    FOR ALL USING (
      user_id = auth.uid() OR 
      user_id IN (SELECT id FROM public.users WHERE lower(email) = lower(auth.jwt() ->> 'email'))
    )
    WITH CHECK (
      user_id = auth.uid() OR 
      user_id IN (SELECT id FROM public.users WHERE lower(email) = lower(auth.jwt() ->> 'email'))
    );

    CREATE POLICY "Incoming instructions ownership" ON public.incoming_category_instruction
    FOR ALL USING (
      user_id = auth.uid() OR 
      user_id IN (SELECT id FROM public.users WHERE lower(email) = lower(auth.jwt() ->> 'email'))
    )
    WITH CHECK (
      user_id = auth.uid() OR 
      user_id IN (SELECT id FROM public.users WHERE lower(email) = lower(auth.jwt() ->> 'email'))
    );

    -- INVESTMENTS
    CREATE POLICY "Investments ownership" ON public.investments
    FOR ALL USING (
      user_id = auth.uid() OR 
      user_id IN (SELECT id FROM public.users WHERE lower(email) = lower(auth.jwt() ->> 'email'))
    )
    WITH CHECK (
      user_id = auth.uid() OR 
      user_id IN (SELECT id FROM public.users WHERE lower(email) = lower(auth.jwt() ->> 'email'))
    );

END $$;
