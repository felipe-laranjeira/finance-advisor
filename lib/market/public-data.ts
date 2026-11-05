import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildPublicStocks, type DividendRecordRow, type MarketStock } from './public-stocks.ts';

function createPublicClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getMarketReferenceDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  const year = part('year');
  const month = part('month');
  const day = part('day');
  if (!year || !month || !day) {
    throw new Error('Could not determine the Sao Paulo market reference date.');
  }
  return `${year}-${month}-${day}`;
}

async function loadPublicDividends(
  supabase: SupabaseClient,
  referenceDate: string,
): Promise<{ data: DividendRecordRow[] | null; error: { message: string } | null }> {
  const firstYear = Number(referenceDate.slice(0, 4)) - 5;
  const firstDate = `${firstYear}-01-01`;
  const pageSize = 1000;
  const rows: DividendRecordRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('dividends_history')
      .select('ticker, event_type, amount_per_share, entitlement_date')
      .gte('entitlement_date', firstDate)
      .lte('entitlement_date', referenceDate)
      .order('entitlement_date')
      .order('ticker')
      .range(offset, offset + pageSize - 1);

    if (error) return { data: null, error };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}

function numericValue(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getPublicStocks(): Promise<MarketStock[]> {
  const supabase = createPublicClient();
  if (!supabase) {
    throw new Error('The public market Supabase client is not configured.');
  }

  const referenceDate = getMarketReferenceDate();
  const [
    { data: tickerRows, error: tickerError },
    { data: companyRows, error: companyError },
    { data: priceRows, error: priceError },
    { data: fundamentalsRows, error: fundamentalsError },
    { data: annualRows, error: annualError },
    { data: dividendRows, error: dividendError },
  ] = await Promise.all([
    supabase
      .from('tickers')
      .select('symbol, company_id, financial_institution_type')
      .eq('is_active', true)
      .eq('exchange', 'B3')
      .order('display_order')
      .order('symbol'),
    supabase
      .from('companies')
      .select('id, name, sector, logo_url')
      .eq('is_active', true),
    supabase
      .from('prices_latest')
      .select('ticker, price, quote_at, fetched_at, is_stale'),
    supabase
      .from('fundamentals_latest')
      .select(
        'ticker, reference_period_end, period_type, revenue, net_income, ebitda, total_debt, cash, eps, book_value_per_share, roe, shares_outstanding, fetched_at, is_stale, last_error',
      ),
    supabase
      .from('financials_annual')
      .select(
        'ticker, fiscal_year_end, consolidation_type, revenue, net_income, cost_of_revenue, selling_general_administrative, other_operating_expenses',
      )
      .eq('consolidation_type', 'consolidated'),
    loadPublicDividends(supabase, referenceDate),
  ]);

  const queryError = [
    tickerError,
    companyError,
    priceError,
    fundamentalsError,
    annualError,
    dividendError,
  ].find((error) => error !== null);

  if (queryError) {
    console.error('Não foi possível carregar os dados fundamentalistas públicos:', queryError.message);
    throw new Error('Could not load public market data.');
  }

  return buildPublicStocks(
    tickerRows ?? [],
    companyRows ?? [],
    (priceRows ?? []).map((row) => ({
      ...row,
      price: Number(row.price),
    })),
    (fundamentalsRows ?? []).map((row) => ({
      ...row,
      revenue: numericValue(row.revenue),
      net_income: numericValue(row.net_income),
      ebitda: numericValue(row.ebitda),
      total_debt: numericValue(row.total_debt),
      cash: numericValue(row.cash),
      eps: numericValue(row.eps),
      book_value_per_share: numericValue(row.book_value_per_share),
      roe: numericValue(row.roe),
      shares_outstanding: numericValue(row.shares_outstanding),
    })),
    annualRows ?? [],
    (dividendRows ?? []).map((row) => ({
      ...row,
      amount_per_share: Number(row.amount_per_share),
    })),
    referenceDate,
  );
}

export async function getStockAnalysis(ticker: string): Promise<MarketStock | null> {
  const stocks = await getPublicStocks();
  return stocks.find((stock) => stock.ticker === ticker) ?? null;
}

export async function getActiveStockSymbols(): Promise<string[]> {
  const supabase = createPublicClient();
  if (!supabase) {
    console.warn('Supabase is not configured; active stocks cannot be emitted to the sitemap.');
    return [];
  }

  const { data, error } = await supabase
    .from('tickers')
    .select('symbol')
    .eq('is_active', true)
    .eq('exchange', 'B3')
    .order('display_order')
    .order('symbol');

  if (error) {
    console.error('Could not load active stock symbols:', error.message);
    throw new Error('Could not load active stock symbols.');
  }

  return (data ?? []).map((row) => row.symbol);
}
