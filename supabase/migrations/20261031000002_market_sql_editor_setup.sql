BEGIN;

CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  tax_id TEXT UNIQUE,
  sector TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tickers (
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

CREATE INDEX IF NOT EXISTS tickers_active_display_order_idx
  ON public.tickers (display_order, symbol)
  WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS public.prices_latest (
  ticker TEXT PRIMARY KEY REFERENCES public.tickers(symbol) ON DELETE RESTRICT,
  price NUMERIC(14, 4) NOT NULL CHECK (price > 0),
  quote_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL,
  last_checked_at TIMESTAMPTZ NOT NULL,
  is_stale BOOLEAN NOT NULL DEFAULT FALSE,
  provider TEXT NOT NULL DEFAULT 'brapi' CHECK (provider = 'brapi')
);

CREATE TABLE IF NOT EXISTS public.prices_daily (
  ticker TEXT NOT NULL REFERENCES public.tickers(symbol) ON DELETE RESTRICT,
  market_date DATE NOT NULL,
  price NUMERIC(14, 4) NOT NULL CHECK (price > 0),
  quote_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL,
  provider TEXT NOT NULL DEFAULT 'brapi' CHECK (provider = 'brapi'),
  PRIMARY KEY (ticker, market_date)
);

CREATE TABLE IF NOT EXISTS public.job_runs (
  id UUID PRIMARY KEY,
  job_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'partial', 'failed', 'skipped')),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  requested_count INTEGER NOT NULL DEFAULT 0 CHECK (requested_count >= 0),
  succeeded_count INTEGER NOT NULL DEFAULT 0 CHECK (succeeded_count >= 0),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  detail TEXT
);

CREATE INDEX IF NOT EXISTS job_runs_daily_market_started_at_idx
  ON public.job_runs (started_at DESC)
  WHERE job_name = 'daily-market-snapshot';

CREATE TABLE IF NOT EXISTS public.market_calendar_status (
  calendar_year INTEGER PRIMARY KEY CHECK (calendar_year BETWEEN 2020 AND 2200),
  is_complete BOOLEAN NOT NULL DEFAULT FALSE,
  source_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.market_holidays (
  holiday_date DATE PRIMARY KEY,
  name TEXT NOT NULL,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prices_latest ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prices_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_calendar_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Companies are publicly readable" ON public.companies;
CREATE POLICY "Companies are publicly readable"
  ON public.companies FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "Tickers are publicly readable" ON public.tickers;
CREATE POLICY "Tickers are publicly readable"
  ON public.tickers FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "Latest market prices are publicly readable" ON public.prices_latest;
CREATE POLICY "Latest market prices are publicly readable"
  ON public.prices_latest FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "Daily market prices are publicly readable" ON public.prices_daily;
CREATE POLICY "Daily market prices are publicly readable"
  ON public.prices_daily FOR SELECT TO anon, authenticated USING (TRUE);

REVOKE ALL ON public.companies, public.tickers, public.prices_latest, public.prices_daily,
  public.job_runs, public.market_calendar_status, public.market_holidays
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.companies, public.tickers, public.prices_latest, public.prices_daily
  TO anon, authenticated;

GRANT ALL ON public.companies, public.tickers, public.prices_latest, public.prices_daily,
  public.job_runs, public.market_calendar_status, public.market_holidays
  TO service_role;

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

INSERT INTO public.market_calendar_status (calendar_year, is_complete)
VALUES (EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER, FALSE)
ON CONFLICT (calendar_year) DO NOTHING;

COMMIT;
