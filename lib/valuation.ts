export type ValuationReason =
  | 'negative_earnings'
  | 'no_dividends'
  | 'provider_unavailable'
  | 'insufficient_history'
  | 'missing_data'
  | 'not_applicable';

export type FormulaResult<T> = {
  value: T | null;
  formula: string;
  reasons: ValuationReason[];
  windowUsed?: 'avg_5_full_calendar_years' | 'last_12_months';
};

export type DividendRecord = {
  amountPerShare: number;
  type: string;
  entitlementDate: string;
};

export type FinancialInstitutionType = 'none' | 'bank' | 'insurer';

export type ValuationStatus =
  | 'below_ceiling'
  | 'between_ceiling_and_fair'
  | 'above_fair'
  | 'not_applicable';

export type ClassificationResult = {
  status: ValuationStatus;
  reasons: ValuationReason[];
  formula: string;
};

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function result<T>(
  value: T | null,
  formula: string,
  reasons: ValuationReason[] = [],
): FormulaResult<T> {
  return { value, formula, reasons: [...new Set(reasons)] };
}

function dateOnly(value: string): string | null {
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`))
    ? date
    : null;
}

function validDividends(dividends: DividendRecord[], referenceDate: string) {
  const reference = dateOnly(referenceDate);
  if (!reference) return [];

  return dividends
    .map((dividend) => ({ ...dividend, date: dateOnly(dividend.entitlementDate) }))
    .filter(
      (dividend): dividend is DividendRecord & { date: string } =>
        dividend.date !== null &&
        dividend.date <= reference &&
        ['dividend', 'dividendo', 'jcp'].includes(dividend.type.toLowerCase()) &&
        isFiniteNumber(dividend.amountPerShare) &&
        dividend.amountPerShare > 0,
    );
}

function trailingTwelveMonthStart(referenceDate: string): string | null {
  const reference = dateOnly(referenceDate);
  if (!reference) return null;

  const date = new Date(`${reference}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() - 1);
  return date.toISOString().slice(0, 10);
}

export function netMargin(
  netIncome: number | null | undefined,
  revenue: number | null | undefined,
): FormulaResult<number> {
  if (!isFiniteNumber(netIncome) || !isFiniteNumber(revenue) || revenue <= 0) {
    return result<number>(null, 'net-margin@1', ['missing_data']);
  }

  return result(netIncome / revenue, 'net-margin@1');
}

export function priceToEarnings(
  price: number | null | undefined,
  eps: number | null | undefined,
): FormulaResult<number> {
  if (!isFiniteNumber(eps)) return result<number>(null, 'price-to-earnings@1', ['missing_data']);
  if (eps <= 0) return result<number>(null, 'price-to-earnings@1', ['negative_earnings']);
  if (!isFiniteNumber(price) || price <= 0) {
    return result<number>(null, 'price-to-earnings@1', ['missing_data']);
  }

  return result(price / eps, 'price-to-earnings@1');
}

export function priceToBook(
  price: number | null | undefined,
  bookValuePerShare: number | null | undefined,
): FormulaResult<number> {
  if (
    !isFiniteNumber(price) ||
    price <= 0 ||
    !isFiniteNumber(bookValuePerShare) ||
    bookValuePerShare <= 0
  ) {
    return result<number>(null, 'price-to-book@1', ['missing_data']);
  }

  return result(price / bookValuePerShare, 'price-to-book@1');
}

export function dividendsPerShare12m(
  dividends: DividendRecord[],
  referenceDate: string,
): FormulaResult<number> {
  const start = trailingTwelveMonthStart(referenceDate);
  if (!start) return result<number>(null, 'dividends-per-share-12m@1', ['missing_data']);

  const amount = validDividends(dividends, referenceDate)
    .filter((dividend) => dividend.date >= start)
    .reduce((total, dividend) => total + dividend.amountPerShare, 0);

  return amount > 0
    ? result(amount, 'dividends-per-share-12m@1')
    : result(0, 'dividends-per-share-12m@1', ['no_dividends']);
}

export function dividendYield(
  dividendsPerShare: number | null | undefined,
  price: number | null | undefined,
): FormulaResult<number> {
  if (!isFiniteNumber(dividendsPerShare) || !isFiniteNumber(price) || price <= 0) {
    return result<number>(null, 'dividend-yield@1', ['missing_data']);
  }
  if (dividendsPerShare <= 0) return result<number>(null, 'dividend-yield@1', ['no_dividends']);

  return result(dividendsPerShare / price, 'dividend-yield@1');
}

export function netDebtToEbitda(
  totalDebt: number | null | undefined,
  cash: number | null | undefined,
  ebitda: number | null | undefined,
  institutionType: FinancialInstitutionType = 'none',
): FormulaResult<number> {
  if (institutionType !== 'none') {
    return result<number>(null, 'net-debt-to-ebitda@1', ['not_applicable']);
  }
  if (!isFiniteNumber(totalDebt) || !isFiniteNumber(cash) || !isFiniteNumber(ebitda)) {
    return result<number>(null, 'net-debt-to-ebitda@1', ['missing_data']);
  }
  if (ebitda <= 0) return result<number>(null, 'net-debt-to-ebitda@1', ['missing_data']);

  return result((totalDebt - cash) / ebitda, 'net-debt-to-ebitda@1');
}

export function operatingExpenses(
  costOfRevenue: number | null | undefined,
  sellingGeneralAdministrative: number | null | undefined,
  otherOperatingExpenses: number | null | undefined,
  institutionType: FinancialInstitutionType = 'none',
): FormulaResult<number> {
  if (institutionType !== 'none') {
    return result<number>(null, 'operating-expenses@1', ['not_applicable']);
  }
  if (
    !isFiniteNumber(costOfRevenue) ||
    !isFiniteNumber(sellingGeneralAdministrative) ||
    !isFiniteNumber(otherOperatingExpenses)
  ) {
    return result<number>(null, 'operating-expenses@1', ['missing_data']);
  }

  return result(
    Math.abs(costOfRevenue) +
      Math.abs(sellingGeneralAdministrative) +
      Math.abs(otherOperatingExpenses),
    'operating-expenses@1',
  );
}

export function ceilingPrice(
  dividends: DividendRecord[],
  referenceDate: string,
  yieldTarget = 0.06,
): FormulaResult<number> {
  if (!isFiniteNumber(yieldTarget) || yieldTarget <= 0) {
    return {
      ...result<number>(null, 'bazin-6pct-avg5y@1', ['missing_data']),
      windowUsed: 'last_12_months',
    };
  }

  const valid = validDividends(dividends, referenceDate);
  if (valid.length === 0) {
    return {
      ...result<number>(null, 'bazin-6pct-avg5y@1', ['no_dividends']),
      windowUsed: 'last_12_months',
    };
  }

  const dates = valid.map((dividend) => Date.parse(`${dividend.date}T00:00:00Z`));
  const historySpan = Math.max(...dates) - Math.min(...dates);
  const hasThreeYearsOfHistory = historySpan >= 3 * 365 * DAY_IN_MILLISECONDS;
  const reference = dateOnly(referenceDate);
  if (!reference) {
    return {
      ...result<number>(null, 'bazin-6pct-avg5y@1', ['missing_data']),
      windowUsed: 'last_12_months',
    };
  }

  if (hasThreeYearsOfHistory) {
    const lastCompleteYear = Number(reference.slice(0, 4)) - 1;
    const firstCompleteYear = lastCompleteYear - 4;
    const start = `${firstCompleteYear}-01-01`;
    const end = `${lastCompleteYear}-12-31`;
    const annualTotal = valid
      .filter((dividend) => dividend.date >= start && dividend.date <= end)
      .reduce((total, dividend) => total + dividend.amountPerShare, 0);
    const averageAnnualDividends = annualTotal / 5;

    return {
      ...result(
        averageAnnualDividends > 0 ? averageAnnualDividends / yieldTarget : null,
        'bazin-6pct-avg5y@1',
        averageAnnualDividends > 0 ? [] : ['no_dividends'],
      ),
      windowUsed: 'avg_5_full_calendar_years',
    };
  }

  const twelveMonthDps = dividendsPerShare12m(valid, reference);
  return {
    ...result(
      twelveMonthDps.value && twelveMonthDps.value > 0
        ? twelveMonthDps.value / yieldTarget
        : null,
      'bazin-6pct-avg5y@1',
      twelveMonthDps.value && twelveMonthDps.value > 0
        ? ['insufficient_history']
        : ['no_dividends', 'insufficient_history'],
    ),
    windowUsed: 'last_12_months',
  };
}

export function fairPrice(
  eps: number | null | undefined,
  bookValuePerShare: number | null | undefined,
): FormulaResult<number> {
  if (!isFiniteNumber(eps) || !isFiniteNumber(bookValuePerShare)) {
    return result<number>(null, 'graham-22.5@1', ['missing_data']);
  }
  if (eps <= 0) return result<number>(null, 'graham-22.5@1', ['negative_earnings']);
  if (bookValuePerShare <= 0) return result<number>(null, 'graham-22.5@1', ['missing_data']);

  return result(Math.sqrt(22.5 * eps * bookValuePerShare), 'graham-22.5@1');
}

export function marginOfSafety(
  reference: number | null | undefined,
  price: number | null | undefined,
): FormulaResult<number> {
  if (!isFiniteNumber(reference) || !isFiniteNumber(price) || reference <= 0) {
    return result<number>(null, 'margin-of-safety@1', ['missing_data']);
  }

  return result((reference - price) / reference, 'margin-of-safety@1');
}

export function classify(
  price: number | null | undefined,
  ceiling: number | null | undefined,
  fair: number | null | undefined,
  reasons: ValuationReason[] = [],
): ClassificationResult {
  const uniqueReasons = [...new Set(reasons)];
  const invalidatingReasons = new Set<ValuationReason>([
    'negative_earnings',
    'no_dividends',
    'missing_data',
    'not_applicable',
  ]);
  if (
    !isFiniteNumber(price) ||
    price <= 0 ||
    !isFiniteNumber(ceiling) ||
    !isFiniteNumber(fair) ||
    uniqueReasons.some((reason) => invalidatingReasons.has(reason))
  ) {
    return {
      status: 'not_applicable',
      reasons: uniqueReasons.length > 0 ? uniqueReasons : ['missing_data'],
      formula: 'valuation-status@1',
    };
  }

  if (price <= ceiling) {
    return { status: 'below_ceiling', reasons: uniqueReasons, formula: 'valuation-status@1' };
  }
  if (price <= fair) {
    return {
      status: 'between_ceiling_and_fair',
      reasons: uniqueReasons,
      formula: 'valuation-status@1',
    };
  }

  return { status: 'above_fair', reasons: uniqueReasons, formula: 'valuation-status@1' };
}
