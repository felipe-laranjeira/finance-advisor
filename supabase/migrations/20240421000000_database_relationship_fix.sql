-- Comprehensive migration to fix all database relationships
-- Ensures all user_id columns reference public.users(id) instead of auth.users(id)
-- Also updates RLS policies to align with custom authentication flow

DO $$
BEGIN
    -- 0. Clean up orphan records that don't exist in the new public.users table
    -- This is necessary to avoid "violates foreign key constraint" errors
    DELETE FROM transactions WHERE user_id NOT IN (SELECT id FROM public.users);
    DELETE FROM investments WHERE user_id NOT IN (SELECT id FROM public.users);
    DELETE FROM budgets WHERE user_id NOT IN (SELECT id FROM public.users);
    DELETE FROM incoming WHERE user_id NOT IN (SELECT id FROM public.users);
    DELETE FROM transactions_category_instruction WHERE user_id NOT IN (SELECT id FROM public.users);
    DELETE FROM incoming_category_instruction WHERE user_id NOT IN (SELECT id FROM public.users);
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'user_id') THEN
        DELETE FROM categories WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.users);
    END IF;

    -- 1. Fix Transactions
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;
    ALTER TABLE transactions ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    
    DROP POLICY IF EXISTS "Allow all operations for transactions" ON transactions;
    DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
    DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
    DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
    DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;
    ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow all operations for transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);

    -- 2. Fix Categories (if user_id exists)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'user_id') THEN
        ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_user_id_fkey;
        ALTER TABLE categories ADD CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
    
    DROP POLICY IF EXISTS "Allow all operations for categories" ON categories;
    DROP POLICY IF EXISTS "Categories are viewable by everyone" ON categories;
    ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow all operations for categories" ON categories FOR ALL USING (true) WITH CHECK (true);

    -- 3. Fix Investments
    ALTER TABLE investments DROP CONSTRAINT IF EXISTS investments_user_id_fkey;
    ALTER TABLE investments ADD CONSTRAINT investments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    
    DROP POLICY IF EXISTS "Allow all operations for investments" ON investments;
    DROP POLICY IF EXISTS "Users can manage their own investments" ON investments;
    ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow all operations for investments" ON investments FOR ALL USING (true) WITH CHECK (true);

    -- 4. Fix Budgets
    ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_user_id_fkey;
    ALTER TABLE budgets ADD CONSTRAINT budgets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    
    DROP POLICY IF EXISTS "Allow all operations for budgets" ON budgets;
    DROP POLICY IF EXISTS "Users can manage their own budgets" ON budgets;
    ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow all operations for budgets" ON budgets FOR ALL USING (true) WITH CHECK (true);

    -- 5. Fix Incoming
    ALTER TABLE incoming DROP CONSTRAINT IF EXISTS incoming_user_id_fkey;
    ALTER TABLE incoming ADD CONSTRAINT incoming_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    
    DROP POLICY IF EXISTS "Allow all operations for incoming" ON incoming;
    DROP POLICY IF EXISTS "Users can manage their own incoming" ON incoming;
    ALTER TABLE incoming ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow all operations for incoming" ON incoming FOR ALL USING (true) WITH CHECK (true);

    -- 6. Fix Transaction Instructions
    ALTER TABLE transactions_category_instruction DROP CONSTRAINT IF EXISTS transactions_category_instruction_user_id_fkey;
    ALTER TABLE transactions_category_instruction ADD CONSTRAINT transactions_category_instruction_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    
    DROP POLICY IF EXISTS "Allow all operations for instructions" ON transactions_category_instruction;
    DROP POLICY IF EXISTS "Users can manage their own instructions" ON transactions_category_instruction;
    ALTER TABLE transactions_category_instruction ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow all operations for instructions" ON transactions_category_instruction FOR ALL USING (true) WITH CHECK (true);

    -- 7. Fix Incoming Instructions
    ALTER TABLE incoming_category_instruction DROP CONSTRAINT IF EXISTS incoming_category_instruction_user_id_fkey;
    ALTER TABLE incoming_category_instruction ADD CONSTRAINT incoming_category_instruction_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    
    DROP POLICY IF EXISTS "Allow all operations for incoming instructions" ON incoming_category_instruction;
    DROP POLICY IF EXISTS "Users can manage their own incoming instructions" ON incoming_category_instruction;
    ALTER TABLE incoming_category_instruction ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow all operations for incoming instructions" ON incoming_category_instruction FOR ALL USING (true) WITH CHECK (true);

    -- 8. Fix users table itself (ensure it can be managed)
    DROP POLICY IF EXISTS "Allow all operations for users" ON users;
    DROP POLICY IF EXISTS "Users can view their own data" ON users;
    DROP POLICY IF EXISTS "Users can update their own data" ON users;
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    -- Note: We allow all for the custom auth logic to query it using the anon key
    CREATE POLICY "Allow all operations for users" ON users FOR ALL USING (true) WITH CHECK (true);

END $$;
