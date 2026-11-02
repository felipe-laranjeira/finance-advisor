ALTER TABLE public.tickers
  ADD COLUMN financial_institution_type TEXT NOT NULL DEFAULT 'none'
    CHECK (financial_institution_type IN ('none', 'bank', 'insurer'));

UPDATE public.tickers
SET financial_institution_type = 'bank'
WHERE symbol IN ('ITUB4', 'BBDC4', 'BBAS3');

CREATE TABLE public.fundamentals_latest (
  ticker TEXT PRIMARY KEY REFERENCES public.tickers(symbol) ON DELETE RESTRICT,
  reference_period_end DATE,
  period_type TEXT NOT NULL DEFAULT 'ttm'
    CHECK (period_type IN ('ttm', 'annual')),
  consolidation_type TEXT
    CHECK (consolidation_type IS NULL OR consolidation_type IN ('consolidated', 'individual')),
  revenue NUMERIC(24, 4),
  net_income NUMERIC(24, 4),
  ebitda NUMERIC(24, 4),
  total_debt NUMERIC(24, 4),
  cash NUMERIC(24, 4),
  net_debt NUMERIC(24, 4),
  equity NUMERIC(24, 4),
  eps NUMERIC(18, 6),
  book_value_per_share NUMERIC(18, 6),
  roe NUMERIC(12, 8),
  shares_outstanding NUMERIC(24, 0),
  sector TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::JSONB,
  fetched_at TIMESTAMPTZ NOT NULL,
  is_stale BOOLEAN NOT NULL DEFAULT FALSE,
  last_error TEXT,
  provider TEXT NOT NULL DEFAULT 'brapi' CHECK (provider = 'brapi')
);

CREATE TABLE public.financials_annual (
  ticker TEXT NOT NULL REFERENCES public.tickers(symbol) ON DELETE RESTRICT,
  fiscal_year_end DATE NOT NULL,
  consolidation_type TEXT NOT NULL
    CHECK (consolidation_type IN ('consolidated', 'individual')),
  revenue NUMERIC(24, 4),
  net_income NUMERIC(24, 4),
  ebitda NUMERIC(24, 4),
  cost_of_revenue NUMERIC(24, 4),
  selling_general_administrative NUMERIC(24, 4),
  other_operating_expenses NUMERIC(24, 4),
  cash NUMERIC(24, 4),
  total_debt NUMERIC(24, 4),
  equity NUMERIC(24, 4),
  raw JSONB NOT NULL DEFAULT '{}'::JSONB,
  fetched_at TIMESTAMPTZ NOT NULL,
  provider TEXT NOT NULL DEFAULT 'brapi' CHECK (provider = 'brapi'),
  PRIMARY KEY (ticker, fiscal_year_end, consolidation_type)
);

CREATE TABLE public.dividends_history (
  ticker TEXT NOT NULL REFERENCES public.tickers(symbol) ON DELETE RESTRICT,
  event_key TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('dividend', 'jcp')),
  amount_per_share NUMERIC(18, 8) NOT NULL CHECK (amount_per_share > 0),
  entitlement_date DATE NOT NULL,
  ex_date DATE,
  payment_date DATE,
  raw JSONB NOT NULL DEFAULT '{}'::JSONB,
  fetched_at TIMESTAMPTZ NOT NULL,
  provider TEXT NOT NULL DEFAULT 'brapi' CHECK (provider = 'brapi'),
  PRIMARY KEY (ticker, event_key)
);

CREATE INDEX fundamentals_latest_stale_idx
  ON public.fundamentals_latest (is_stale, fetched_at);

CREATE INDEX financials_annual_period_idx
  ON public.financials_annual (fiscal_year_end DESC);

CREATE INDEX dividends_history_entitlement_date_idx
  ON public.dividends_history (ticker, entitlement_date DESC);

CREATE INDEX job_runs_fundamentals_started_at_idx
  ON public.job_runs (started_at DESC)
  WHERE job_name = 'fundamentals-snapshot';

ALTER TABLE public.fundamentals_latest ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financials_annual ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dividends_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Latest stock fundamentals are publicly readable"
  ON public.fundamentals_latest
  FOR SELECT
  USING (TRUE);

CREATE POLICY "Annual stock financials are publicly readable"
  ON public.financials_annual
  FOR SELECT
  USING (TRUE);

CREATE POLICY "Stock dividends are publicly readable"
  ON public.dividends_history
  FOR SELECT
  USING (TRUE);

REVOKE ALL ON public.fundamentals_latest, public.financials_annual, public.dividends_history
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.fundamentals_latest, public.financials_annual, public.dividends_history
  TO anon, authenticated;

GRANT ALL ON public.fundamentals_latest, public.financials_annual, public.dividends_history
  TO service_role;
