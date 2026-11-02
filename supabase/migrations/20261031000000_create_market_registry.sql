CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  tax_id TEXT UNIQUE,
  sector TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.tickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  symbol TEXT NOT NULL UNIQUE CHECK (symbol ~ '^[A-Z0-9]{4,6}$'),
  exchange TEXT NOT NULL DEFAULT 'B3',
  asset_type TEXT NOT NULL DEFAULT 'equity'
    CHECK (asset_type IN ('equity', 'unit', 'bdr', 'etf', 'fii', 'other')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX tickers_active_display_order_idx
  ON public.tickers (display_order, symbol)
  WHERE is_active = TRUE;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Companies are publicly readable"
  ON public.companies
  FOR SELECT
  USING (TRUE);

CREATE POLICY "Tickers are publicly readable"
  ON public.tickers
  FOR SELECT
  USING (TRUE);

GRANT SELECT ON public.companies, public.tickers TO anon, authenticated;
GRANT ALL ON public.companies, public.tickers TO service_role;

INSERT INTO public.companies (name, sector)
VALUES
  ('Petróleo Brasileiro S.A. - Petrobras', 'Petróleo, gás e biocombustíveis'),
  ('Vale S.A.', 'Materiais básicos'),
  ('Itaú Unibanco Holding S.A.', 'Financeiro'),
  ('Banco Bradesco S.A.', 'Financeiro'),
  ('Banco do Brasil S.A.', 'Financeiro'),
  ('Ambev S.A.', 'Consumo não cíclico'),
  ('WEG S.A.', 'Bens industriais'),
  ('B3 S.A. - Brasil, Bolsa, Balcão', 'Financeiro'),
  ('Localiza Rent a Car S.A.', 'Consumo cíclico'),
  ('Suzano S.A.', 'Materiais básicos')
ON CONFLICT (name) DO UPDATE
SET sector = EXCLUDED.sector;

INSERT INTO public.tickers (company_id, symbol, asset_type, display_order)
SELECT companies.id, seed.symbol, 'equity', seed.display_order
FROM (
  VALUES
    ('Petróleo Brasileiro S.A. - Petrobras', 'PETR4', 1),
    ('Vale S.A.', 'VALE3', 2),
    ('Itaú Unibanco Holding S.A.', 'ITUB4', 3),
    ('Banco Bradesco S.A.', 'BBDC4', 4),
    ('Banco do Brasil S.A.', 'BBAS3', 5),
    ('Ambev S.A.', 'ABEV3', 6),
    ('WEG S.A.', 'WEGE3', 7),
    ('B3 S.A. - Brasil, Bolsa, Balcão', 'B3SA3', 8),
    ('Localiza Rent a Car S.A.', 'RENT3', 9),
    ('Suzano S.A.', 'SUZB3', 10)
) AS seed(company_name, symbol, display_order)
JOIN public.companies AS companies ON companies.name = seed.company_name
ON CONFLICT (symbol) DO UPDATE
SET company_id = EXCLUDED.company_id,
    asset_type = EXCLUDED.asset_type,
    is_active = TRUE,
    display_order = EXCLUDED.display_order;
