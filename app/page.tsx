import type { Metadata } from 'next';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import MarketHome from '@/components/MarketHome';
import {
  buildPublicStocks,
  type DividendRecordRow,
} from '@/lib/market/public-stocks';

export const metadata: Metadata = {
  title: 'Ações da B3 | Financial Advisor',
  description:
    'Consulte indicadores fundamentalistas e compare empresas da bolsa brasileira. Conteúdo informativo, sem recomendação de investimento.',
};

export const dynamic = 'force-dynamic';

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
) {
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

export default async function HomePage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return (
      <MarketHome
        stocks={[]}
        loadError="Os dados do mercado não puderam ser carregados porque o Supabase não está configurado."
      />
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
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
      .select('id, name, sector')
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
    return (
      <MarketHome
        stocks={[]}
        loadError="Não foi possível carregar os dados agora. Tente atualizar a página mais tarde."
      />
    );
  }

  const stocks = buildPublicStocks(
    tickerRows ?? [],
    companyRows ?? [],
    (priceRows ?? []).map((row) => ({
      ...row,
      price: Number(row.price),
    })),
    (fundamentalsRows ?? []).map((row) => ({
      ...row,
      revenue: row.revenue === null ? null : Number(row.revenue),
      net_income: row.net_income === null ? null : Number(row.net_income),
      ebitda: row.ebitda === null ? null : Number(row.ebitda),
      total_debt: row.total_debt === null ? null : Number(row.total_debt),
      cash: row.cash === null ? null : Number(row.cash),
      eps: row.eps === null ? null : Number(row.eps),
      book_value_per_share:
        row.book_value_per_share === null ? null : Number(row.book_value_per_share),
      roe: row.roe === null ? null : Number(row.roe),
      shares_outstanding:
        row.shares_outstanding === null ? null : Number(row.shares_outstanding),
    })),
    annualRows ?? [],
    (dividendRows ?? []).map((row) => ({
      ...row,
      amount_per_share: Number(row.amount_per_share),
    })),
    referenceDate,
  );

  return <MarketHome stocks={stocks} loadError={null} />;
}
