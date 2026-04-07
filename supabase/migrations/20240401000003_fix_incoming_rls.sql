-- Fix incoming table and ensure RLS is correct
-- Drop ALL policies on the incoming table to avoid dependency errors
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'incoming') LOOP
        EXECUTE format('DROP POLICY %I ON incoming', pol.policyname);
    END LOOP;
END
$$;

ALTER TABLE incoming DROP CONSTRAINT IF EXISTS incoming_user_id_fkey;
-- Ensure user_id is UUID and references auth.users
ALTER TABLE incoming ALTER COLUMN user_id TYPE UUID USING user_id::UUID;
ALTER TABLE incoming ADD CONSTRAINT incoming_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Ensure incoming_categories has correct RLS
ALTER TABLE incoming_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read for incoming_categories" ON incoming_categories;
CREATE POLICY "Public read for incoming_categories" ON incoming_categories
  FOR SELECT USING (true);

-- Ensure incoming has correct RLS
ALTER TABLE incoming ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own incoming" ON incoming;
CREATE POLICY "Users can manage their own incoming" ON incoming
  FOR ALL USING (auth.uid() = user_id);

-- Ensure incoming_category_instruction has correct RLS
ALTER TABLE incoming_category_instruction ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own incoming instructions" ON incoming_category_instruction;
CREATE POLICY "Users can manage their own incoming instructions" ON incoming_category_instruction
  FOR ALL USING (auth.uid() = user_id);
