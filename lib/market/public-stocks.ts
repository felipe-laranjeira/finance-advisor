import {
  ceilingPrice,
  classify,
  dividendYield,
  dividendsPerShare12m,
  fairPrice,
  marginOfSafety,
  netDebtToEbitda,
  netMargin,
  operatingExpenses,
  priceToBook,
  priceToEarnings,
  type FormulaResult,
  type ValuationReason,
  type ValuationStatus,
} from '../valuation.ts';

export type TickerRecord = {
  symbol: string;
  company_id: string;
  financial_institution_type: 'none' | 'bank' | 'insurer';
};

export type CompanyRecord = {
  id: string;
  name: string;
  sector: string;
};

export type PriceRecord = {
  ticker: string;
  price: number | string;
  quote_at: string | null;
  fetched_at: string;
  is_stale: boolean;
};

export type FundamentalsRecord = {
  ticker: string;
  reference_period_end: string | null;
  period_type: 'ttm' | 'annual';
  revenue: number | string | null;
  net_income: number | string | null;
  ebitda: number | string | null;
  total_debt: number | string | null;
  cash: number | string | null;
  eps: number | string | null;
  book_value_per_share: number | string | null;
  roe: number | string | null;
  shares_outstanding: number | string | null;
  fetched_at: string;
  is_stale: boolean;
  last_error: string | null;
};

export type AnnualFinancialRecord = {
  ticker: string;
  fiscal_year_end: string;
  consolidation_type: 'consolidated' | 'individual';
  revenue: number | string | null;
  net_income: number | string | null;
  cost_of_revenue: number | string | null;
  selling_general_administrative: number | string | null;
  other_operating_expenses: number | string | null;
};

export type DividendRecordRow = {
  ticker: string;
  event_type: 'dividend' | 'jcp';
  amount_per_share: number | string;
  entitlement_date: string;
};

export type MarketMetric =
  | 'price'
  | 'revenue'
  | 'operatingExpenses'
  | 'netIncome'
  | 'netMargin'
  | 'pe'
  | 'pb'
  | 'dividendYield'
  | 'roe'
  | 'netDebtToEbitda'
  | 'ceiling'
  | 'fairPrice';

export type MarketStock = {
  ticker: string;
  company: string;
  sector: string;
  financialInstitutionType: TickerRecord['financial_institution_type'];
  price: number | null;
  quoteAt: string | null;
  priceFetchedAt: string | null;
  priceIsStale: boolean;
  revenue: number | null;
  operatingExpenses: number | null;
  netIncome: number | null;
  netMargin: number | null;
  pe: number | null;
  pb: number | null;
  dividendYield: number | null;
  roe: number | null;
  netDebtToEbitda: number | null;
  ceiling: number | null;
  fairPrice: number | null;
  ceilingMarginOfSafety: number | null;
  fairMarginOfSafety: number | null;
  ceilingWindow: FormulaResult<number>['windowUsed'];
  annualPeriodEnd: string | null;
  ttmPeriodEnd: string | null;
  fundamentalsFetchedAt: string | null;
  fundamentalsAreStale: boolean;
  reasons: Partial<Record<MarketMetric, ValuationReason[]>>;
  formulas: Partial<Record<MarketMetric, string>>;
  status: ValuationStatus;
  statusReasons: ValuationReason[];
};

function numericValue(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function uniqueReasons(reasons: ValuationReason[]): ValuationReason[] {
  return [...new Set(reasons)];
}

function latestConsolidatedAnnual(
  records: AnnualFinancialRecord[],
  ticker: string,
): AnnualFinancialRecord | undefined {
  return records
    .filter((record) => record.ticker === ticker && record.consolidation_type === 'consolidated')
    .sort((left, right) => right.fiscal_year_end.localeCompare(left.fiscal_year_end))[0];
}

export function buildPublicStocks(
  tickers: TickerRecord[],
  companies: CompanyRecord[],
  prices: PriceRecord[],
  fundamentals: FundamentalsRecord[],
  annualFinancials: AnnualFinancialRecord[],
  dividends: DividendRecordRow[],
  referenceDate = new Date().toISOString().slice(0, 10),
): MarketStock[] {
  const companiesById = new Map(companies.map((company) => [company.id, company]));
  const pricesByTicker = new Map(prices.map((price) => [price.ticker, price]));
  const fundamentalsByTicker = new Map(fundamentals.map((row) => [row.ticker, row]));
  const dividendsByTicker = new Map<string, DividendRecordRow[]>();

  for (const dividend of dividends) {
    const tickerDividends = dividendsByTicker.get(dividend.ticker) ?? [];
    tickerDividends.push(dividend);
    dividendsByTicker.set(dividend.ticker, tickerDividends);
  }

  return tickers.map((ticker) => {
    const company = companiesById.get(ticker.company_id);
    const quote = pricesByTicker.get(ticker.symbol);
    const current = fundamentalsByTicker.get(ticker.symbol);
    const annual = latestConsolidatedAnnual(annualFinancials, ticker.symbol);
    const annualRevenue = numericValue(annual?.revenue);
    const annualNetIncome = numericValue(annual?.net_income);
    const currentRevenue = numericValue(current?.revenue);
    const currentNetIncome = numericValue(current?.net_income);
    const hasAnnualPair = annualRevenue !== null && annualNetIncome !== null;
    const revenue = hasAnnualPair ? annualRevenue : currentRevenue;
    const netIncome = hasAnnualPair ? annualNetIncome : currentNetIncome;
    const price = numericValue(quote?.price);
    const eps = numericValue(current?.eps);
    const bookValuePerShare = numericValue(current?.book_value_per_share);
    const dpsEvents = (dividendsByTicker.get(ticker.symbol) ?? []).map((dividend) => ({
      amountPerShare: Number(dividend.amount_per_share),
      type: dividend.event_type,
      entitlementDate: dividend.entitlement_date,
    }));
    const formulas: Partial<Record<MarketMetric, string>> = {};
    const reasons: Partial<Record<MarketMetric, ValuationReason[]>> = {};

    const netMarginResult = netMargin(netIncome, revenue);
    const expensesResult = operatingExpenses(
      numericValue(annual?.cost_of_revenue),
      numericValue(annual?.selling_general_administrative),
      numericValue(annual?.other_operating_expenses),
      ticker.financial_institution_type,
    );
    const peResult = priceToEarnings(price, eps);
    const pbResult = priceToBook(price, bookValuePerShare);
    const dps12mResult = dividendsPerShare12m(dpsEvents, referenceDate);
    const yieldResult = dividendYield(dps12mResult.value, price);
    const ceilingResult = ceilingPrice(dpsEvents, referenceDate);
    const dividendEndpointUnavailable =
      current?.last_error?.includes(`${ticker.symbol} dividends:`) ?? false;
    const yieldReasons =
      dividendEndpointUnavailable &&
      yieldResult.value === null &&
      yieldResult.reasons.includes('no_dividends')
        ? ['provider_unavailable' as const]
        : yieldResult.reasons;
    const ceilingReasons =
      dividendEndpointUnavailable &&
      ceilingResult.value === null &&
      ceilingResult.reasons.includes('no_dividends')
        ? ['provider_unavailable' as const]
        : ceilingResult.reasons;
    const fairResult = fairPrice(eps, bookValuePerShare);
    const netDebtResult = netDebtToEbitda(
      numericValue(current?.total_debt),
      numericValue(current?.cash),
      numericValue(current?.ebitda),
      ticker.financial_institution_type,
    );
    const ceilingSafety = marginOfSafety(ceilingResult.value, price);
    const fairSafety = marginOfSafety(fairResult.value, price);
    const classificationReasons = uniqueReasons([
      ...ceilingReasons,
      ...fairResult.reasons,
      ...(price === null ? ['missing_data' as const] : []),
    ]);
    const classification = classify(
      price,
      ceilingResult.value,
      fairResult.value,
      classificationReasons,
    );
    formulas.netMargin = netMarginResult.formula;
    formulas.operatingExpenses = expensesResult.formula;
    formulas.pe = peResult.formula;
    formulas.pb = pbResult.formula;
    formulas.dividendYield = yieldResult.formula;
    formulas.roe = 'return-on-equity-brapi@1';
    formulas.netDebtToEbitda = netDebtResult.formula;
    formulas.ceiling = ceilingResult.formula;
    formulas.fairPrice = fairResult.formula;
    formulas.price = 'brapi-regular-market-price@1';

    if (revenue === null) reasons.revenue = ['missing_data'];
    if (expensesResult.reasons.length > 0) reasons.operatingExpenses = expensesResult.reasons;
    if (netIncome === null) reasons.netIncome = ['missing_data'];
    if (netMarginResult.reasons.length > 0) reasons.netMargin = netMarginResult.reasons;
    if (peResult.reasons.length > 0) reasons.pe = peResult.reasons;
    if (pbResult.reasons.length > 0) reasons.pb = pbResult.reasons;
    if (yieldReasons.length > 0) reasons.dividendYield = yieldReasons;
    if (current?.roe === null || current?.roe === undefined) reasons.roe = ['missing_data'];
    if (netDebtResult.reasons.length > 0) reasons.netDebtToEbitda = netDebtResult.reasons;
    if (ceilingReasons.length > 0) reasons.ceiling = ceilingReasons;
    if (fairResult.reasons.length > 0) reasons.fairPrice = fairResult.reasons;
    if (price === null) reasons.price = ['missing_data'];

    return {
      ticker: ticker.symbol,
      company: company?.name ?? ticker.symbol,
      sector: company?.sector ?? 'Setor não informado',
      financialInstitutionType: ticker.financial_institution_type,
      price,
      quoteAt: quote?.quote_at ?? null,
      priceFetchedAt: quote?.fetched_at ?? null,
      priceIsStale: quote?.is_stale ?? false,
      revenue,
      operatingExpenses: expensesResult.value,
      netIncome,
      netMargin: netMarginResult.value,
      pe: peResult.value,
      pb: pbResult.value,
      dividendYield: yieldResult.value,
      roe: numericValue(current?.roe),
      netDebtToEbitda: netDebtResult.value,
      ceiling: ceilingResult.value,
      fairPrice: fairResult.value,
      ceilingMarginOfSafety: ceilingSafety.value,
      fairMarginOfSafety: fairSafety.value,
      ceilingWindow: ceilingResult.windowUsed,
      annualPeriodEnd: hasAnnualPair ? annual?.fiscal_year_end ?? null : null,
      ttmPeriodEnd: current?.reference_period_end ?? null,
      fundamentalsFetchedAt: current?.fetched_at ?? null,
      fundamentalsAreStale: current?.is_stale ?? true,
      reasons,
      formulas,
      status: classification.status,
      statusReasons: classification.reasons,
    };
  });
}

export function reasonLabel(reason: ValuationReason): string {
  switch (reason) {
    case 'negative_earnings':
      return 'Lucro por ação não positivo';
    case 'no_dividends':
      return 'Sem dividendos ou JCP na janela';
    case 'provider_unavailable':
      return 'Dados indisponíveis no provedor';
    case 'insufficient_history':
      return 'Histórico menor que três anos; usada a janela de 12 meses';
    case 'not_applicable':
      return 'Fórmula não aplicável a bancos e seguradoras';
    case 'missing_data':
      return 'Dado ausente ou sem base válida';
  }
}
