CREATE TABLE public.prices_latest (
  ticker TEXT PRIMARY KEY REFERENCES public.tickers(symbol) ON DELETE RESTRICT,
  price NUMERIC(14, 4) NOT NULL CHECK (price > 0),
  quote_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL,
  last_checked_at TIMESTAMPTZ NOT NULL,
  is_stale BOOLEAN NOT NULL DEFAULT FALSE,
  provider TEXT NOT NULL DEFAULT 'brapi' CHECK (provider = 'brapi')
);

CREATE TABLE public.prices_daily (
  ticker TEXT NOT NULL REFERENCES public.tickers(symbol) ON DELETE RESTRICT,
  market_date DATE NOT NULL,
  price NUMERIC(14, 4) NOT NULL CHECK (price > 0),
  quote_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL,
  provider TEXT NOT NULL DEFAULT 'brapi' CHECK (provider = 'brapi'),
  PRIMARY KEY (ticker, market_date)
);

CREATE TABLE public.job_runs (
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

CREATE INDEX job_runs_daily_market_started_at_idx
  ON public.job_runs (started_at DESC)
  WHERE job_name = 'daily-market-snapshot';

CREATE TABLE public.market_calendar_status (
  calendar_year INTEGER PRIMARY KEY CHECK (calendar_year BETWEEN 2020 AND 2200),
  is_complete BOOLEAN NOT NULL DEFAULT FALSE,
  source_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.market_holidays (
  holiday_date DATE PRIMARY KEY,
  name TEXT NOT NULL,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.prices_latest ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prices_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_calendar_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Latest market prices are publicly readable"
  ON public.prices_latest FOR SELECT USING (TRUE);

CREATE POLICY "Daily market prices are publicly readable"
  ON public.prices_daily FOR SELECT USING (TRUE);

GRANT SELECT ON public.prices_latest, public.prices_daily TO anon, authenticated;
GRANT ALL ON public.prices_latest, public.prices_daily, public.job_runs,
  public.market_calendar_status, public.market_holidays TO service_role;
REVOKE ALL ON public.job_runs, public.market_calendar_status, public.market_holidays
  FROM anon, authenticated;

INSERT INTO public.market_calendar_status (calendar_year, is_complete)
VALUES (2026, FALSE)
ON CONFLICT (calendar_year) DO NOTHING;
