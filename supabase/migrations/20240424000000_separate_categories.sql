-- Migration: Extreme Separation of Expenses and Investments
-- Target: Split categories and transactions into separate domains

-- 0. Ensure source tables have required columns before migration
DO $$ 
BEGIN 
    -- Ensure categories has user_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'user_id') THEN
        ALTER TABLE public.categories ADD COLUMN user_id UUID;
    END IF;
    
    -- Ensure categories has is_investment
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'is_investment') THEN
        ALTER TABLE public.categories ADD COLUMN is_investment BOOLEAN DEFAULT FALSE;
    END IF;

    -- Ensure transactions has user_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'user_id') THEN
        ALTER TABLE public.transactions ADD COLUMN user_id UUID;
    END IF;

    -- Ensure budgets has user_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'budgets' AND column_name = 'user_id') THEN
        ALTER TABLE public.budgets ADD COLUMN user_id UUID;
    END IF;
END $$;

-- 1. Create Category Tables
CREATE TABLE IF NOT EXISTS transactions_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investiments_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Migrate Categories (Preserving one ID per unique name for global use)
INSERT INTO transactions_categories (id, name, created_at)
SELECT DISTINCT ON (name) id, name, created_at 
FROM categories 
WHERE is_investment = false
ORDER BY name, id
ON CONFLICT (name) DO NOTHING;

INSERT INTO investiments_categories (id, name, created_at)
SELECT DISTINCT ON (name) id, name, created_at 
FROM categories 
WHERE is_investment = true
ORDER BY name, id
ON CONFLICT (name) DO NOTHING;

-- 3. Create Transaction Tables
CREATE TABLE IF NOT EXISTS expense_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  category_id UUID REFERENCES transactions_categories(id) ON DELETE SET NULL,
  amount DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  category_id UUID REFERENCES investiments_categories(id) ON DELETE SET NULL,
  amount DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Migrate Transactions (Merging potential duplicates by joining on name)
INSERT INTO expense_transactions (id, user_id, date, description, category_id, amount, created_at)
SELECT t.id, t.user_id, t.date, t.description, tc.id, t.amount, t.created_at
FROM transactions t
JOIN categories c ON t.category_id = c.id
JOIN transactions_categories tc ON c.name = tc.name
WHERE c.is_investment = false
ON CONFLICT (id) DO NOTHING;

INSERT INTO investment_transactions (id, user_id, date, description, category_id, amount, created_at)
SELECT t.id, t.user_id, t.date, t.description, ic.id, t.amount, t.created_at
FROM transactions t
JOIN categories c ON t.category_id = c.id
JOIN investiments_categories ic ON c.name = ic.name
WHERE c.is_investment = true
ON CONFLICT (id) DO NOTHING;

-- 5. Create Budget Tables
CREATE TABLE IF NOT EXISTS expense_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES transactions_categories(id) ON DELETE CASCADE,
  limit_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category_id)
);

CREATE TABLE IF NOT EXISTS investment_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES investiments_categories(id) ON DELETE CASCADE,
  limit_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category_id)
);

-- 6. Migrate Budgets (Merging potential duplicates by joining on name)
INSERT INTO expense_budgets (id, user_id, category_id, limit_amount, created_at, updated_at)
SELECT b.id, b.user_id, tc.id, b.limit_amount, b.created_at, b.updated_at
FROM budgets b
JOIN categories c ON b.category_id = c.id
JOIN transactions_categories tc ON c.name = tc.name
WHERE c.is_investment = false
ON CONFLICT (id) DO NOTHING;

INSERT INTO investment_budgets (id, user_id, category_id, limit_amount, created_at, updated_at)
SELECT b.id, b.user_id, ic.id, b.limit_amount, b.created_at, b.updated_at
FROM budgets b
JOIN categories c ON b.category_id = c.id
JOIN investiments_categories ic ON c.name = ic.name
WHERE c.is_investment = true
ON CONFLICT (id) DO NOTHING;

-- 7. Update AI Instruction Table
-- This table is for "transaction categories" (expenses)
-- We need to update existing instructions to point to the correct global category IDs

-- 7.1 Remove instructions for categories that used to be investments 
DELETE FROM public.transactions_category_instruction
WHERE category_id IN (SELECT id FROM public.categories WHERE is_investment = true);

-- 7.2 Update remaining instructions to use new global IDs
UPDATE public.transactions_category_instruction tci
SET category_id = tc.id
FROM public.categories c
JOIN public.transactions_categories tc ON c.name = tc.name
WHERE tci.category_id = c.id
AND c.is_investment = false;

-- 7.3 Remove any remaining instructions that don't have a valid category in the new table
DELETE FROM public.transactions_category_instruction
WHERE category_id NOT IN (SELECT id FROM public.transactions_categories);

-- 7.4 Restore Foreign Key Constraint
ALTER TABLE public.transactions_category_instruction DROP CONSTRAINT IF EXISTS transactions_category_instruction_category_id_fkey;
ALTER TABLE public.transactions_category_instruction ADD CONSTRAINT transactions_category_instruction_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.transactions_categories(id) ON DELETE CASCADE;

-- 8. Enable RLS on new tables
ALTER TABLE transactions_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE investiments_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_budgets ENABLE ROW LEVEL SECURITY;

-- 9. Create RLS Policies
DROP POLICY IF EXISTS "Users can manage their own expense categories" ON transactions_categories;
CREATE POLICY "Public read for transactions_categories" ON transactions_categories FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert expense categories" ON transactions_categories FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can manage their own investment categories" ON investiments_categories;
CREATE POLICY "Public read for investiments_categories" ON investiments_categories FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert investment categories" ON investiments_categories FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can manage their own expense transactions" ON expense_transactions;
CREATE POLICY "Users can manage their own expense transactions" ON expense_transactions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own investment transactions" ON investment_transactions;
CREATE POLICY "Users can manage their own investment transactions" ON investment_transactions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own expense budgets" ON expense_budgets;
CREATE POLICY "Users can manage their own expense budgets" ON expense_budgets FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own investment budgets" ON investment_budgets;
CREATE POLICY "Users can manage their own investment budgets" ON investment_budgets FOR ALL USING (auth.uid() = user_id);

-- 10. DROP OLD TABLES
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
