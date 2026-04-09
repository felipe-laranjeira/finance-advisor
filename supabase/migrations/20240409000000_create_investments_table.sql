-- Create investments table
CREATE TABLE IF NOT EXISTS investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  asset_name text NOT NULL,
  broker text NOT NULL,
  asset_type text NOT NULL,
  balance decimal(12,2) NOT NULL DEFAULT 0,
  reference_date date NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, asset_name, broker, reference_date)
);

-- Enable RLS
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Users can manage their own investments"
  ON investments
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
