-- Create transactions_category_instruction table
CREATE TABLE IF NOT EXISTS transactions_category_instruction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, description)
);

-- Enable RLS
ALTER TABLE transactions_category_instruction ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own instructions" ON transactions_category_instruction
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own instructions" ON transactions_category_instruction
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own instructions" ON transactions_category_instruction
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own instructions" ON transactions_category_instruction
  FOR DELETE USING (auth.uid() = user_id);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to call the function
CREATE TRIGGER update_transactions_category_instruction_updated_at
BEFORE UPDATE ON transactions_category_instruction
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
