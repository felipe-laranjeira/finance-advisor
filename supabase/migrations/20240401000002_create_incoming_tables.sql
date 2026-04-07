-- Create incoming_categories table
CREATE TABLE IF NOT EXISTS incoming_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create incoming table
CREATE TABLE IF NOT EXISTS incoming (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  category_id UUID REFERENCES incoming_categories(id),
  type TEXT CHECK (type IN ('ativa', 'passiva')) NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE incoming_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE incoming ENABLE ROW LEVEL SECURITY;

-- Policies for incoming_categories (public read)
CREATE POLICY "Public read for incoming_categories" ON incoming_categories
  FOR SELECT USING (true);

-- Policies for incoming
CREATE POLICY "Users can manage their own incoming" ON incoming
  FOR ALL USING (auth.uid() = user_id);

-- Insert default categories for income
INSERT INTO incoming_categories (name) VALUES 
  ('Salário'),
  ('Freelance'),
  ('Dividendos'),
  ('Aluguel'),
  ('Investimentos'),
  ('Outros')
ON CONFLICT (name) DO NOTHING;

-- Create incoming_category_instruction table
CREATE TABLE IF NOT EXISTS incoming_category_instruction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  description TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES incoming_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, description)
);

-- Enable RLS
ALTER TABLE incoming_category_instruction ENABLE ROW LEVEL SECURITY;

-- Policies for incoming_category_instruction
CREATE POLICY "Users can manage their own incoming instructions" ON incoming_category_instruction
  FOR ALL USING (auth.uid() = user_id);
