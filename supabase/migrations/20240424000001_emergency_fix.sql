-- EMERGENCY FIX: Repairing tables and permissions for global categories
-- This version handles orphan records that prevent constraint creation

-- 1. Ensure categories exist (Global)
INSERT INTO public.transactions_categories (name)
VALUES 
  ('Alimentação'), ('Transporte'), ('Saúde'), ('Educação'), 
  ('Lazer'), ('Moradia'), ('Outros')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.investiments_categories (name)
VALUES 
  ('Ações'), ('FIIs'), ('Cripto'), ('Tesouro Direto'), 
  ('Reserva de Emergência'), ('Renda Fixa'), ('ETF Internacional')
ON CONFLICT (name) DO NOTHING;

-- 2. Repair Foreign Keys (Pointing to auth.users for better compatibility)
-- We first DELETE any record that doesn't have a valid user to avoid Constraint Violation
DO $$ 
BEGIN
    -- Cleanup orphans first (VERY IMPORTANT)
    DELETE FROM public.expense_transactions WHERE user_id NOT IN (SELECT id FROM auth.users);
    DELETE FROM public.investment_transactions WHERE user_id NOT IN (SELECT id FROM auth.users);
    DELETE FROM public.expense_budgets WHERE user_id NOT IN (SELECT id FROM auth.users);
    DELETE FROM public.investment_budgets WHERE user_id NOT IN (SELECT id FROM auth.users);

    -- Now add/repair constraints
    -- Expense Transactions
    ALTER TABLE public.expense_transactions DROP CONSTRAINT IF EXISTS expense_transactions_user_id_fkey;
    ALTER TABLE public.expense_transactions ADD CONSTRAINT expense_transactions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    -- Investment Transactions
    ALTER TABLE public.investment_transactions DROP CONSTRAINT IF EXISTS investment_transactions_user_id_fkey;
    ALTER TABLE public.investment_transactions ADD CONSTRAINT investment_transactions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    -- Budgets
    ALTER TABLE public.expense_budgets DROP CONSTRAINT IF EXISTS expense_budgets_user_id_fkey;
    ALTER TABLE public.expense_budgets ADD CONSTRAINT expense_budgets_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    ALTER TABLE public.investment_budgets DROP CONSTRAINT IF EXISTS investment_budgets_user_id_fkey;
    ALTER TABLE public.investment_budgets ADD CONSTRAINT investment_budgets_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;

-- 3. Reset RLS Policies to ensure access
ALTER TABLE public.expense_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own expense transactions" ON public.expense_transactions;
CREATE POLICY "Users can manage their own expense transactions" 
ON public.expense_transactions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own investment transactions" ON public.investment_transactions;
CREATE POLICY "Users can manage their own investment transactions" 
ON public.investment_transactions FOR ALL USING (auth.uid() = user_id);

-- Categories (Public Read)
ALTER TABLE public.transactions_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investiments_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for transactions_categories" ON public.transactions_categories;
CREATE POLICY "Public read for transactions_categories" ON public.transactions_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read for investiments_categories" ON public.investiments_categories;
CREATE POLICY "Public read for investiments_categories" ON public.investiments_categories FOR SELECT USING (true);
