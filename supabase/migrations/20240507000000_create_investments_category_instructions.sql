-- Create investments_category_instruction table
CREATE TABLE IF NOT EXISTS investments_category_instruction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_name TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES investiments_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, asset_name)
);

-- Enable RLS
ALTER TABLE investments_category_instruction ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own investment instructions" ON investments_category_instruction
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create a trigger to update the updated_at timestamp
CREATE TRIGGER update_investments_category_instruction_updated_at
BEFORE UPDATE ON investments_category_instruction
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
