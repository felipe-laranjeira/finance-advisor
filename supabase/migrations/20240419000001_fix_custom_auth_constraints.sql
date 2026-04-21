-- Migration to fix foreign keys and policies for custom authentication
-- This moves references from auth.users to public.users and adjusts RLS

-- 1. Fix Transactions
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;
ALTER TABLE transactions ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete their own transactions" ON transactions;

CREATE POLICY "Allow all operations for transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);

-- 2. Fix Categories
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_user_id_fkey;
ALTER TABLE categories ADD CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Users can view system and own categories" ON categories;
DROP POLICY IF EXISTS "Users can insert their own categories" ON categories;
DROP POLICY IF EXISTS "Users can update their own categories" ON categories;
DROP POLICY IF EXISTS "Users can delete their own categories" ON categories;
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON categories;
DROP POLICY IF EXISTS "Authenticated users can manage categories" ON categories;

CREATE POLICY "Allow all operations for categories" ON categories FOR ALL USING (true) WITH CHECK (true);

-- 3. Fix Investments
ALTER TABLE investments DROP CONSTRAINT IF EXISTS investments_user_id_fkey;
ALTER TABLE investments ADD CONSTRAINT investments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Users can manage their own investments" ON investments;
CREATE POLICY "Allow all operations for investments" ON investments FOR ALL USING (true) WITH CHECK (true);

-- 4. Fix Budgets
DROP POLICY IF EXISTS "Users can manage their own budgets" ON budgets;
CREATE POLICY "Allow all operations for budgets" ON budgets FOR ALL USING (true) WITH CHECK (true);

-- 5. Fix Incoming
ALTER TABLE incoming DROP CONSTRAINT IF EXISTS incoming_user_id_fkey;
ALTER TABLE incoming ADD CONSTRAINT incoming_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Users can manage their own incoming" ON incoming;
CREATE POLICY "Allow all operations for incoming" ON incoming FOR ALL USING (true) WITH CHECK (true);

-- 6. Fix Instructions
ALTER TABLE transactions_category_instruction DROP CONSTRAINT IF EXISTS transactions_category_instruction_user_id_fkey;
ALTER TABLE transactions_category_instruction ADD CONSTRAINT transactions_category_instruction_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Users can view their own instructions" ON transactions_category_instruction;
DROP POLICY IF EXISTS "Users can insert their own instructions" ON transactions_category_instruction;
DROP POLICY IF EXISTS "Users can update their own instructions" ON transactions_category_instruction;
DROP POLICY IF EXISTS "Users can delete their own instructions" ON transactions_category_instruction;

CREATE POLICY "Allow all operations for instructions" ON transactions_category_instruction FOR ALL USING (true) WITH CHECK (true);

-- 7. Fix Incoming Instructions
ALTER TABLE incoming_category_instruction DROP CONSTRAINT IF EXISTS incoming_category_instruction_user_id_fkey;
ALTER TABLE incoming_category_instruction ADD CONSTRAINT incoming_category_instruction_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Users can manage their own incoming instructions" ON incoming_category_instruction;
CREATE POLICY "Allow all operations for incoming instructions" ON incoming_category_instruction FOR ALL USING (true) WITH CHECK (true);
