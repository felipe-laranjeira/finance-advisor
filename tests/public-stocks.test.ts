import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  buildPublicStocks,
  type AnnualFinancialRecord,
  type CompanyRecord,
  type DividendRecordRow,
  type FundamentalsRecord,
  type PriceRecord,
  type TickerRecord,
} from '../lib/market/public-stocks.ts';

type FixturePayload = {
  error?: boolean;
  code?: string;
  message?: string;
  results?: Array<{
    requestedSymbol?: string;
    symbol?: string;
    data?: Record<string, unknown> | Array<Record<string, unknown>>;
  }>;
};

const symbols = ['ITUB4', 'WEGE3', 'MGLU3', 'PETR4'];
const tickers: TickerRecord[] = symbols.map((symbol) => ({
  symbol,
  company_id: symbol,
  financial_institution_type: symbol === 'ITUB4' ? 'bank' : 'none',
}));
const companies: CompanyRecord[] = symbols.map((symbol) => ({
  id: symbol,
  name: `${symbol} S.A.`,
  sector: symbol === 'ITUB4' ? 'Financeiro' : 'Indústria',
  logo_url: typeof record(responseData(symbol, 'quote')).logourl === 'string'
    ? String(record(responseData(symbol, 'quote')).logourl)
    : null,
}));

function fixture(ticker: string, endpoint: string): FixturePayload {
  const content = readFileSync(
    join(process.cwd(), 'tests', 'fixtures', 'brapi', `${ticker.toLowerCase()}-${endpoint}.json`),
    'utf8',
  );
  return JSON.parse(content) as FixturePayload;
}

function responseData(ticker: string, endpoint: string) {
  const payload = fixture(ticker, endpoint);
  if (payload.error) return null;
  return payload.results?.[0]?.data ?? null;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function numberOrNull(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

const prices: PriceRecord[] = symbols.flatMap((symbol) => {
  const quote = record(responseData(symbol, 'quote'));
  const price = numberOrNull(quote.regularMarketPrice);
  if (price === null) return [];
  return [{
    ticker: symbol,
    price,
    quote_at: typeof quote.regularMarketTime === 'string' ? quote.regularMarketTime : null,
    fetched_at: '2026-11-02T12:00:00.000Z',
    is_stale: false,
  }];
});

const fundamentals: FundamentalsRecord[] = symbols.map((symbol) => {
  const statistics = record(responseData(symbol, 'statistics'));
  const financialData = record(responseData(symbol, 'financial-data'));
  const referencePeriod =
    statistics.mostRecentQuarter ?? financialData.mostRecentQuarter ?? null;

  return {
    ticker: symbol,
    reference_period_end: typeof referencePeriod === 'string' ? referencePeriod : null,
    period_type: 'ttm',
    revenue: numberOrNull(financialData.totalRevenue),
    net_income:
      numberOrNull(financialData.netIncome) ?? numberOrNull(statistics.netIncomeToCommon),
    ebitda: numberOrNull(financialData.ebitda),
    total_debt: numberOrNull(financialData.totalDebt),
    cash: numberOrNull(financialData.totalCash),
    eps: numberOrNull(statistics.trailingEps),
    book_value_per_share: numberOrNull(statistics.bookValue),
    roe: numberOrNull(financialData.returnOnEquity),
    shares_outstanding: numberOrNull(statistics.sharesOutstanding),
    fetched_at: '2026-11-02T12:00:00.000Z',
    is_stale: fixture(symbol, 'statistics').error === true ||
      fixture(symbol, 'financial-data').error === true,
    last_error: fixture(symbol, 'financial-data').message ?? null,
  };
});

const annualFinancials: AnnualFinancialRecord[] = symbols.flatMap((symbol) => {
  const data = responseData(symbol, 'income-statement');
  if (!Array.isArray(data)) return [];
  return data
    .filter((row) => row.consolidationType === 'consolidated')
    .map((row) => ({
      ticker: symbol,
      fiscal_year_end: String(row.endDate),
      consolidation_type: 'consolidated' as const,
      revenue: numberOrNull(row.totalRevenue),
      net_income: numberOrNull(row.netIncome),
      cost_of_revenue: numberOrNull(row.costOfRevenue),
      selling_general_administrative: numberOrNull(row.sellingGeneralAdministrative),
      other_operating_expenses: numberOrNull(row.otherOperatingExpenses),
    }));
});

const dividends: DividendRecordRow[] = symbols.flatMap((symbol) => {
  const data = record(responseData(symbol, 'dividends'));
  const events = Array.isArray(data.cashDividends) ? data.cashDividends : [];
  return events.flatMap((event) => {
    const row = record(event);
    const type =
      row.label === 'JCP' ? 'jcp' : row.label === 'DIVIDENDO' ? 'dividend' : null;
    const amount = numberOrNull(row.rate);
    if (
      !type ||
      amount === null ||
      typeof row.lastDatePrior !== 'string'
    ) {
      return [];
    }

    return [{
      ticker: symbol,
      event_type: type,
      amount_per_share: amount,
      entitlement_date: row.lastDatePrior,
    }];
  });
});

test('maps each discovered ticker to real metrics or an explicit unavailable reason', () => {
  const stocks = buildPublicStocks(
    tickers,
    companies,
    prices,
    fundamentals,
    annualFinancials,
    dividends,
    '2026-11-02',
  );

  assert.equal(stocks.length, 4);
  for (const stock of stocks) {
    assert.ok(stock.price !== null, `${stock.ticker} quote is mapped`);
    for (const key of [
      'revenue',
      'operatingExpenses',
      'netIncome',
      'netMargin',
      'pe',
      'pb',
      'dividendYield',
      'roe',
      'netDebtToEbitda',
      'ceiling',
      'fairPrice',
    ] as const) {
      const value = stock[key];
      assert.ok(
        value !== null || (stock.reasons[key] && stock.reasons[key]!.length > 0),
        `${stock.ticker} ${key} is numeric or has an explicit reason`,
      );
    }
  }

  const bank = stocks.find((stock) => stock.ticker === 'ITUB4');
  assert.equal(bank?.netDebtToEbitda, null);
  assert.deepEqual(bank?.reasons.netDebtToEbitda, ['not_applicable']);

  const petr4Stock = stocks.find((stock) => stock.ticker === 'PETR4');
  assert.equal(petr4Stock?.logoUrl, 'https://icons.brapi.dev/icons/PETR4.svg');

  const deniedTicker = stocks.find((stock) => stock.ticker === 'WEGE3');
  assert.equal(deniedTicker?.roe, null);
  assert.equal(deniedTicker?.pe, null);
  assert.equal(deniedTicker?.status, 'not_applicable');
});

test('keeps absent quote and fundamentals unavailable rather than estimating them', () => {
  const [stock] = buildPublicStocks(
    [{
      symbol: 'TEST3',
      company_id: 'TEST3',
      financial_institution_type: 'none',
    }],
    [{ id: 'TEST3', name: 'Test S.A.', sector: 'Indústria', logo_url: null }],
    [],
    [],
    [],
    [],
    '2026-11-02',
  );

  assert.equal(stock.logoUrl, null);
  assert.equal(stock.price, null);
  assert.equal(stock.ceiling, null);
  assert.equal(stock.fairPrice, null);
  assert.ok(stock.reasons.price?.length);
  assert.ok(stock.reasons.ceiling?.length);
  assert.ok(stock.reasons.fairPrice?.length);
});

test('marks dividend formulas unavailable when brapi denies the dividends endpoint', () => {
  const ticker: TickerRecord = {
    symbol: 'TEST3',
    company_id: 'TEST3',
    financial_institution_type: 'none',
  };
  const stock = buildPublicStocks(
    [ticker],
    [{ id: 'TEST3', name: 'Test S.A.', sector: 'Indústria' }],
    [{
      ticker: 'TEST3',
      price: 10,
      quote_at: '2026-11-02T12:00:00.000Z',
      fetched_at: '2026-11-02T12:00:00.000Z',
      is_stale: false,
    }],
    [{
      ticker: 'TEST3',
      reference_period_end: null,
      period_type: 'ttm',
      revenue: null,
      net_income: null,
      ebitda: null,
      total_debt: null,
      cash: null,
      eps: null,
      book_value_per_share: null,
      roe: null,
      shares_outstanding: null,
      fetched_at: '2026-11-02T12:00:00.000Z',
      is_stale: true,
      last_error: 'TEST3 dividends: HTTP 403: FEATURE_NOT_AVAILABLE',
    }],
    [],
    [],
    '2026-11-02',
  )[0];

  assert.equal(stock.dividendYield, null);
  assert.equal(stock.ceiling, null);
  assert.deepEqual(stock.reasons.dividendYield, ['provider_unavailable']);
  assert.deepEqual(stock.reasons.ceiling, ['provider_unavailable']);
  assert.deepEqual(stock.statusReasons, ['provider_unavailable', 'missing_data']);
});
