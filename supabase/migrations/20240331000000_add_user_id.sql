-- Migration to add user_id to categories and transactions
-- This handles existing data by allowing NULL user_id initially

-- 1. Update categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Remove the global unique constraint on name to allow different users to have same category names
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;

-- Add a new unique constraint for (name, user_id)
-- Note: In PostgreSQL, UNIQUE constraints treat NULLs as distinct, so we might need a partial index or just accept it.
-- For system categories (user_id IS NULL), we still want name to be unique among them.
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_user_id_idx ON categories (name, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS categories_system_name_idx ON categories (name) WHERE user_id IS NULL;

-- 2. Update transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 3. Enable Row Level Security
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies for categories
-- Users can see system categories (user_id IS NULL) and their own categories
CREATE POLICY "Users can view system and own categories" ON categories
  FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can insert their own categories" ON categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories" ON categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories" ON categories
  FOR DELETE USING (auth.uid() = user_id);

-- 5. Create Policies for transactions
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" ON transactions
  FOR DELETE USING (auth.uid() = user_id);
