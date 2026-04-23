-- Add is_investment column to categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_investment BOOLEAN DEFAULT FALSE;

-- Update existing "Investimentos" category
UPDATE categories SET is_investment = TRUE WHERE name = 'Investimentos';

-- Insert more specific investment categories for better tracking
INSERT INTO categories (name, is_investment) VALUES 
  ('Ações', TRUE),
  ('FIIs', TRUE),
  ('Cripto', TRUE),
  ('Tesouro Direto', TRUE),
  ('Reserva de Emergência', TRUE)
ON CONFLICT (name) DO UPDATE SET is_investment = EXCLUDED.is_investment;

-- Mark consumption categories explicitly (though they default to false, this is for clarity)
UPDATE categories SET is_investment = FALSE WHERE name NOT IN (
  'Investimentos', 'Ações', 'FIIs', 'Cripto', 'Tesouro Direto', 'Reserva de Emergência'
);
