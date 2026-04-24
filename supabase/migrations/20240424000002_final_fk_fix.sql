-- FINAL FIX: Category Foreign Key and RLS Alignment
-- This script repairs the relationship between transactions and the new global categories

-- 1. Ensure "Outros" exists as a safety net in both global tables
INSERT INTO public.transactions_categories (name) VALUES ('Outros') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.investiments_categories (name) VALUES ('Outros') ON CONFLICT (name) DO NOTHING;

-- 2. Repairing Expense Transactions Table Structure
DO $$ 
BEGIN
    -- Remove ANY old constraints that might be pointing to the deleted 'categories' table
    ALTER TABLE public.expense_transactions DROP CONSTRAINT IF EXISTS expense_transactions_category_id_fkey;
    
    -- Ensure category_id is correctly linked to the NEW global table
    ALTER TABLE public.expense_transactions 
    ADD CONSTRAINT expense_transactions_category_id_fkey 
    FOREIGN KEY (category_id) REFERENCES public.transactions_categories(id) ON DELETE SET NULL;

    -- Repeat for Investments
    ALTER TABLE public.investment_transactions DROP CONSTRAINT IF EXISTS investment_transactions_category_id_fkey;
    ALTER TABLE public.investment_transactions 
    ADD CONSTRAINT investment_transactions_category_id_fkey 
    FOREIGN KEY (category_id) REFERENCES public.investiments_categories(id) ON DELETE SET NULL;
END $$;

-- 3. Solidifying RLS (Specifically for INSERT operations)
-- Sometimes FOR ALL policies fail on INSERT if not explicitly defined with CHECK
ALTER TABLE public.expense_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own expense transactions" ON public.expense_transactions;
CREATE POLICY "Users can manage their own expense transactions" 
ON public.expense_transactions 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.investment_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own investment transactions" ON public.investment_transactions;
CREATE POLICY "Users can manage their own investment transactions" 
ON public.investment_transactions 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Global Categories Public Access
ALTER TABLE public.transactions_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read for transactions_categories" ON public.transactions_categories;
CREATE POLICY "Public read for transactions_categories" ON public.transactions_categories FOR SELECT USING (true);

ALTER TABLE public.investiments_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read for investiments_categories" ON public.investiments_categories;
CREATE POLICY "Public read for investiments_categories" ON public.investiments_categories FOR SELECT USING (true);
