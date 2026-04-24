-- CORRECTION: Pointing Foreign Keys to the correct users table
-- The application uses a custom public.users table instead of Supabase's auth.users

DO $$ 
BEGIN
    -- 1. Expense Transactions
    ALTER TABLE public.expense_transactions DROP CONSTRAINT IF EXISTS expense_transactions_user_id_fkey;
    ALTER TABLE public.expense_transactions ADD CONSTRAINT expense_transactions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

    -- 2. Investment Transactions
    ALTER TABLE public.investment_transactions DROP CONSTRAINT IF EXISTS investment_transactions_user_id_fkey;
    ALTER TABLE public.investment_transactions ADD CONSTRAINT investment_transactions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

    -- 3. Budgets
    ALTER TABLE public.expense_budgets DROP CONSTRAINT IF EXISTS expense_budgets_user_id_fkey;
    ALTER TABLE public.expense_budgets ADD CONSTRAINT expense_budgets_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

    ALTER TABLE public.investment_budgets DROP CONSTRAINT IF EXISTS investment_budgets_user_id_fkey;
    ALTER TABLE public.investment_budgets ADD CONSTRAINT investment_budgets_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

    -- 5. Category Instructions
    -- First remove old constraint
    ALTER TABLE public.transactions_category_instruction DROP CONSTRAINT IF EXISTS transactions_category_instruction_user_id_fkey;
    ALTER TABLE public.transactions_category_instruction DROP CONSTRAINT IF EXISTS transactions_category_instruction_category_id_fkey;

    -- Update FKs
    ALTER TABLE public.transactions_category_instruction ADD CONSTRAINT transactions_category_instruction_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

    ALTER TABLE public.transactions_category_instruction ADD CONSTRAINT transactions_category_instruction_category_id_fkey 
    FOREIGN KEY (category_id) REFERENCES public.transactions_categories(id) ON DELETE CASCADE;

    -- 6. Incoming (Income) Tables
    ALTER TABLE public.incoming DROP CONSTRAINT IF EXISTS incoming_user_id_fkey;
    ALTER TABLE public.incoming ADD CONSTRAINT incoming_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

    ALTER TABLE public.incoming_category_instruction DROP CONSTRAINT IF EXISTS incoming_category_instruction_user_id_fkey;
    ALTER TABLE public.incoming_category_instruction ADD CONSTRAINT incoming_category_instruction_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

    -- DISABLE RLS GLOBALLY (To support CUSTOM authentication system without Supabase Auth session)
    ALTER TABLE public.expense_transactions DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.investment_transactions DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.incoming DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.expense_budgets DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.investment_budgets DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.transactions_categories DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.investiments_categories DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.incoming_categories DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.transactions_category_instruction DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.incoming_category_instruction DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.investments DISABLE ROW LEVEL SECURITY;
END $$;
