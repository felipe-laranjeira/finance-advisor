-- Drop all existing policies on the categories table to avoid dependency issues
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'categories'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON categories', policy_record.policyname);
    END LOOP;
END $$;

-- Now remove user_id from categories table with CASCADE to handle any other dependencies
ALTER TABLE categories DROP COLUMN IF EXISTS user_id CASCADE;

-- Create new domain-wide policies
CREATE POLICY "Categories are viewable by everyone" ON categories
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage categories" ON categories
  FOR ALL TO authenticated USING (true);
