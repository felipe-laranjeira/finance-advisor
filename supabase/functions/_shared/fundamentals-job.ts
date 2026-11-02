import type { MarketRuntimeConfig } from './market.ts';

type TickerRow = { symbol: string };
type EndpointName =
  | 'statistics'
  | 'financial-data'
  | 'income-statement'
  | 'balance-sheet'
  | 'dividends';
type ApiData = Record<string, unknown> | Array<Record<string, unknown>>;
type ApiPayload = {
  results?: Array<{
    requestedSymbol?: string;
    symbol?: string;
    data?: ApiData | null;
  }>;
  error?: boolean;
  code?: string;
  message?: string;
};
type DatabaseRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

export type FundamentalsJobDependencies = {
  databaseRequest: DatabaseRequest;
  fetcher: typeof fetch;
  delay: (milliseconds: number) => Promise<void>;
  now: () => Date;
};

type SnapshotResult = {
  status: 'succeeded' | 'partial' | 'failed';
  requestedCount: number;
  succeededCount: number;
  requestCount: number;
  failures: string[];
};

const jobName = 'fundamentals-snapshot';
const endpoints: EndpointName[] = [
  'statistics',
  'financial-data',
  'income-statement',
  'balance-sheet',
  'dividends',
];

class ProviderError extends Error {
  readonly status?: number;
  readonly retryAfterMilliseconds?: number;

  constructor(
    message: string,
    status?: number,
    retryAfterMilliseconds?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
    this.retryAfterMilliseconds = retryAfterMilliseconds;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numericValue(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function firstNumber(record: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = numericValue(record[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function dateOnly(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length < 10) return undefined;
  const date = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  return Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ? undefined : date;
}

function asRecords(value: ApiData | null | undefined): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  return isRecord(value) ? [value] : [];
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected provider request failure.';
}

function buildEndpointUrl(endpoint: EndpointName, ticker: string): URL {
  const url = new URL(`https://brapi.dev/api/v2/stocks/${endpoint}`);
  url.searchParams.set('symbols', ticker);

  if (endpoint === 'statistics' || endpoint === 'financial-data') {
    url.searchParams.set('mode', 'current');
  }
  if (endpoint === 'income-statement' || endpoint === 'balance-sheet') {
    url.searchParams.set('period', 'annual');
  }

  return url;
}

async function fetchEndpoint(
  config: MarketRuntimeConfig,
  fetcher: typeof fetch,
  ticker: string,
  endpoint: EndpointName,
): Promise<ApiData> {
  const response = await fetcher(buildEndpointUrl(endpoint, ticker), {
    headers: { Authorization: `Bearer ${config.brapiApiKey}` },
  });
  const body = await response.text();
  let payload: ApiPayload;

  try {
    payload = JSON.parse(body) as ApiPayload;
  } catch {
    throw new ProviderError(`HTTP ${response.status}: brapi returned invalid JSON.`, response.status);
  }

  if (!response.ok || payload.error) {
    const code = payload.code ? ` ${payload.code}` : '';
    const detail = payload.message ? ` ${payload.message}` : '';
    const retryAfter = Number(response.headers.get('retry-after'));
    throw new ProviderError(
      `HTTP ${response.status}:${code}${detail}`.trim(),
      response.status,
      response.status === 429 && Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : undefined,
    );
  }

  const result = payload.results?.find(
    (item) => item.requestedSymbol === ticker || item.symbol === ticker,
  );
  if (!result || result.data === undefined || result.data === null) {
    throw new ProviderError('brapi returned no data for the requested ticker.');
  }

  return result.data;
}

function getCurrentFundamentals(
  ticker: string,
  payloads: Partial<Record<EndpointName, ApiData>>,
  fetchedAt: string,
  failures: string[],
): Record<string, unknown> {
  const statistics = asRecords(payloads.statistics)[0] ?? {};
  const financialData = asRecords(payloads['financial-data'])[0] ?? {};
  const annualBalances = asRecords(payloads['balance-sheet']);
  const mostRecentBalance = annualBalances
    .filter((record) => record.consolidationType === 'consolidated')
    .sort((left, right) =>
      String(right.endDate ?? '').localeCompare(String(left.endDate ?? '')),
    )[0];

  const totalDebt = firstNumber(financialData, 'totalDebt');
  const cash = firstNumber(financialData, 'totalCash', 'cash');
  const data: Record<string, unknown> = {
    ticker,
    fetched_at: fetchedAt,
    is_stale: failures.length > 0,
    last_error: failures.length > 0 ? failures.join('; ').slice(0, 2000) : null,
    period_type: 'ttm',
    provider: 'brapi',
    raw: Object.fromEntries(
      Object.entries(payloads).map(([name, value]) => [name, value]),
    ),
    revenue: null,
    net_income: null,
    ebitda: null,
    total_debt: null,
    cash: null,
    net_debt: null,
    equity: null,
    eps: null,
    book_value_per_share: null,
    roe: null,
    shares_outstanding: null,
  };

  const referencePeriodEnd =
    dateOnly(statistics.mostRecentQuarter) ??
    dateOnly(financialData.mostRecentQuarter) ??
    dateOnly(mostRecentBalance?.endDate);
  if (referencePeriodEnd) data.reference_period_end = referencePeriodEnd;

  const fields: Array<[string, number | undefined]> = [
    ['revenue', firstNumber(financialData, 'totalRevenue')],
    ['net_income', firstNumber(financialData, 'netIncome') ?? firstNumber(statistics, 'netIncomeToCommon')],
    ['ebitda', firstNumber(financialData, 'ebitda')],
    ['total_debt', totalDebt],
    ['cash', cash],
    ['eps', firstNumber(statistics, 'trailingEps', 'earningsPerShare')],
    ['book_value_per_share', firstNumber(statistics, 'bookValue')],
    ['roe', firstNumber(financialData, 'returnOnEquity')],
    ['shares_outstanding', firstNumber(statistics, 'sharesOutstanding')],
    ['equity', mostRecentBalance ? firstNumber(mostRecentBalance, 'totalStockholderEquity', 'shareholdersEquity') : undefined],
  ];

  for (const [field, value] of fields) {
    if (value !== undefined) data[field] = value;
  }
  if (totalDebt !== undefined && cash !== undefined) data.net_debt = totalDebt - cash;

  return data;
}

function getAnnualFinancials(
  ticker: string,
  incomeStatement: ApiData | undefined,
  balanceSheet: ApiData | undefined,
  fetchedAt: string,
): Record<string, unknown>[] {
  const incomeByPeriod = new Map<string, Record<string, unknown>>();
  const balanceByPeriod = new Map<string, Record<string, unknown>>();

  for (const record of asRecords(incomeStatement)) {
    const fiscalYearEnd = dateOnly(record.endDate);
    const consolidationType = record.consolidationType;
    if (
      fiscalYearEnd &&
      (consolidationType === 'consolidated' || consolidationType === 'individual')
    ) {
      incomeByPeriod.set(`${fiscalYearEnd}:${consolidationType}`, record);
    }
  }

  for (const record of asRecords(balanceSheet)) {
    const fiscalYearEnd = dateOnly(record.endDate);
    const consolidationType = record.consolidationType;
    if (
      fiscalYearEnd &&
      (consolidationType === 'consolidated' || consolidationType === 'individual')
    ) {
      balanceByPeriod.set(`${fiscalYearEnd}:${consolidationType}`, record);
    }
  }

  const periods = new Set([...incomeByPeriod.keys(), ...balanceByPeriod.keys()]);
  return [...periods].map((period) => {
    const [fiscalYearEnd, consolidationType] = period.split(':');
    const income = incomeByPeriod.get(period);
    const balance = balanceByPeriod.get(period);
    const row: Record<string, unknown> = {
      ticker,
      fiscal_year_end: fiscalYearEnd,
      consolidation_type: consolidationType,
      fetched_at: fetchedAt,
      provider: 'brapi',
      raw: {
        ...(income ? { incomeStatement: income } : {}),
        ...(balance ? { balanceSheet: balance } : {}),
      },
    };

    const fields: Array<[string, number | undefined]> = [
      ['revenue', income ? firstNumber(income, 'totalRevenue') : undefined],
      ['net_income', income ? firstNumber(income, 'netIncome', 'netIncomeFromContinuingOps') : undefined],
      ['ebitda', income ? firstNumber(income, 'ebitda', 'cleanEbitda') : undefined],
      ['cost_of_revenue', income ? firstNumber(income, 'costOfRevenue') : undefined],
      ['selling_general_administrative', income ? firstNumber(income, 'sellingGeneralAdministrative', 'administrativeCosts') : undefined],
      ['other_operating_expenses', income ? firstNumber(income, 'otherOperatingExpenses') : undefined],
      ['cash', balance ? firstNumber(balance, 'cash', 'cashAndCashEquivalents') : undefined],
      ['total_debt', balance ? firstNumber(balance, 'totalDebt') : undefined],
      ['equity', balance ? firstNumber(balance, 'totalStockholderEquity', 'shareholdersEquity', 'controllerShareholdersEquity') : undefined],
    ];

    for (const [field, value] of fields) {
      row[field] = value ?? null;
    }

    if (balance && row.total_debt === undefined) {
      const shortTermDebt = firstNumber(balance, 'shortLongTermDebt');
      const longTermDebt = firstNumber(balance, 'longTermDebt');
      if (shortTermDebt !== undefined || longTermDebt !== undefined) {
        row.total_debt = (shortTermDebt ?? 0) + (longTermDebt ?? 0);
      }
    }

    return row;
  });
}

function getDividendRows(
  ticker: string,
  dividendsData: ApiData | undefined,
  fetchedAt: string,
): Record<string, unknown>[] {
  const data = asRecords(dividendsData)[0];
  if (!data || !Array.isArray(data.cashDividends)) return [];

  const eventsByKey = new Map<
    string,
    { amount: number; events: Record<string, unknown>[]; signatures: Set<string> }
  >();

  for (const event of data.cashDividends) {
    if (!isRecord(event)) continue;
    const label = typeof event.label === 'string' ? event.label.toLowerCase() : '';
    const eventType =
      label === 'jcp' ? 'jcp' : label === 'dividendo' ? 'dividend' : undefined;
    const amount = numericValue(event.rate);
    const entitlementDate = dateOnly(event.lastDatePrior);
    if (!eventType || amount === undefined || amount <= 0 || !entitlementDate) continue;

    const exDate = dateOnly(event.exDate);
    const paymentDate = dateOnly(event.paymentDate);
    const eventKey = [
      eventType,
      entitlementDate,
      exDate ?? '',
      paymentDate ?? '',
    ].join('|');
    const signature = [eventType, amount, entitlementDate, exDate ?? '', paymentDate ?? ''].join('|');
    let grouped = eventsByKey.get(eventKey);
    if (!grouped) {
      grouped = { amount: 0, events: [], signatures: new Set() };
      eventsByKey.set(eventKey, grouped);
    }
    if (grouped.signatures.has(signature)) continue;
    grouped.signatures.add(signature);
    grouped.amount += amount;
    grouped.events.push(event);
  }

  return [...eventsByKey].map(([eventKey, grouped]) => {
    const [eventType, entitlementDate, exDate, paymentDate] = eventKey.split('|');
    return {
      ticker,
      event_key: eventKey,
      event_type: eventType,
      amount_per_share: grouped.amount,
      entitlement_date: entitlementDate,
      ...(exDate ? { ex_date: exDate } : {}),
      ...(paymentDate ? { payment_date: paymentDate } : {}),
      raw: grouped.events.length === 1 ? grouped.events[0] : grouped.events,
      fetched_at: fetchedAt,
      provider: 'brapi',
    };
  });
}

function mergePreservingExisting(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...existing, ...incoming };
  for (const [field, value] of Object.entries(incoming)) {
    if (
      value === null &&
      field !== 'last_error' &&
      field !== 'raw' &&
      existing[field] !== null &&
      existing[field] !== undefined
    ) {
      merged[field] = existing[field];
    }
  }

  const existingRaw = isRecord(existing.raw) ? existing.raw : {};
  const incomingRaw = isRecord(incoming.raw) ? incoming.raw : {};
  merged.raw = { ...existingRaw, ...incomingRaw };
  return merged;
}

function preservedNullFields(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): string[] {
  const nullableFields = [
    'revenue',
    'net_income',
    'ebitda',
    'total_debt',
    'cash',
    'net_debt',
    'equity',
    'eps',
    'book_value_per_share',
    'roe',
    'shares_outstanding',
    'cost_of_revenue',
    'selling_general_administrative',
    'other_operating_expenses',
  ];

  return nullableFields.filter(
    (field) =>
      incoming[field] === null &&
      existing[field] !== null &&
      existing[field] !== undefined,
  );
}

function recordKey(row: Record<string, unknown>): string {
  return `${String(row.fiscal_year_end)}:${String(row.consolidation_type)}`;
}

async function upsertTickerData(
  dependencies: FundamentalsJobDependencies,
  ticker: string,
  payloads: Partial<Record<EndpointName, ApiData>>,
  fetchedAt: string,
  failures: string[],
): Promise<string[]> {
  const currentRows = await dependencies.databaseRequest<Record<string, unknown>[]>(
    `fundamentals_latest?select=*&ticker=eq.${encodeURIComponent(ticker)}`,
  );
  const current = getCurrentFundamentals(ticker, payloads, fetchedAt, failures);
  const annualRows = getAnnualFinancials(
    ticker,
    payloads['income-statement'],
    payloads['balance-sheet'],
    fetchedAt,
  );
  const warnings: string[] = [];
  const existingCurrent = currentRows[0];
  if (existingCurrent) {
    const retainedFields = preservedNullFields(existingCurrent, current);
    if (retainedFields.length > 0) {
      warnings.push(
        `${ticker} fundamentals: null values for ${retainedFields.join(', ')}; previous values retained.`,
      );
    }
  }

  let existingAnnualRows: Record<string, unknown>[] = [];
  const hasAnnualResponse =
    payloads['income-statement'] !== undefined || payloads['balance-sheet'] !== undefined;
  if (hasAnnualResponse) {
    existingAnnualRows = await dependencies.databaseRequest<Record<string, unknown>[]>(
      `financials_annual?select=*&ticker=eq.${encodeURIComponent(ticker)}`,
    );
    if (annualRows.length === 0 && existingAnnualRows.length > 0) {
      warnings.push(`${ticker} annual statements returned no records; previous values retained.`);
    }

    const existingByPeriod = new Map(existingAnnualRows.map((row) => [recordKey(row), row]));
    for (const row of annualRows) {
      const existing = existingByPeriod.get(recordKey(row));
      if (!existing) continue;
      const retainedFields = preservedNullFields(existing, row);
      if (retainedFields.length > 0) {
        warnings.push(
          `${ticker} ${String(row.fiscal_year_end)}: null values for ${retainedFields.join(', ')}; previous values retained.`,
        );
      }
    }
  }

  const currentErrors = [...failures, ...warnings];
  current.is_stale = currentErrors.length > 0;
  current.last_error = currentErrors.length > 0 ? currentErrors.join('; ').slice(0, 2000) : null;
  const currentRow = existingCurrent
    ? mergePreservingExisting(existingCurrent, current)
    : current;

  await dependencies.databaseRequest<void>('fundamentals_latest?on_conflict=ticker', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(currentRow),
  });

  if (annualRows.length > 0) {
    const existingByPeriod = new Map(existingAnnualRows.map((row) => [recordKey(row), row]));
    const mergedRows = annualRows.map((row) => {
      const existing = existingByPeriod.get(recordKey(row));
      return existing ? mergePreservingExisting(existing, row) : row;
    });

    await dependencies.databaseRequest<void>(
      'financials_annual?on_conflict=ticker,fiscal_year_end,consolidation_type',
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(mergedRows),
      },
    );
  }

  const dividendRows = getDividendRows(ticker, payloads.dividends, fetchedAt);
  if (dividendRows.length > 0) {
    const rowsByShape = new Map<string, Record<string, unknown>[]>();
    for (const row of dividendRows) {
      const shape = Object.keys(row).sort().join(',');
      const rows = rowsByShape.get(shape) ?? [];
      rows.push(row);
      rowsByShape.set(shape, rows);
    }

    for (const rows of rowsByShape.values()) {
      await dependencies.databaseRequest<void>(
        'dividends_history?on_conflict=ticker,event_key',
        {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(rows),
        },
      );
    }
  }

    return warnings;
}

async function updateJobRun(
  dependencies: FundamentalsJobDependencies,
  runId: string,
  result: SnapshotResult,
): Promise<void> {
  await dependencies.databaseRequest<void>(`job_runs?id=eq.${runId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      status: result.status,
      completed_at: dependencies.now().toISOString(),
      requested_count: result.requestedCount,
      succeeded_count: result.succeededCount,
      request_count: result.requestCount,
      detail: result.failures.length > 0 ? result.failures.join('; ').slice(0, 20_000) : null,
    }),
  });
}

export async function executeFundamentalsSnapshot(
  config: MarketRuntimeConfig,
  dependencies: FundamentalsJobDependencies,
): Promise<SnapshotResult> {
  const startedAt = dependencies.now();
  const runId = crypto.randomUUID();
  await dependencies.databaseRequest<void>('job_runs', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: runId,
      job_name: jobName,
      status: 'running',
      started_at: startedAt.toISOString(),
    }),
  });

  const result: SnapshotResult = {
    status: 'failed',
    requestedCount: 0,
    succeededCount: 0,
    requestCount: 0,
    failures: [],
  };

  try {
    const tickers = await dependencies.databaseRequest<TickerRow[]>(
      'tickers?select=symbol&is_active=eq.true&exchange=eq.B3&order=display_order.asc,symbol.asc',
    );
    if (tickers.length === 0) throw new Error('No active B3 tickers are configured.');

    result.requestedCount = tickers.length;
    let tickersWithData = 0;
    let requestWindowStartedAt = Date.now();
    let requestsInWindow = 0;

    for (const { symbol } of tickers) {
      const payloads: Partial<Record<EndpointName, ApiData>> = {};
      const tickerFailures: string[] = [];

      for (const endpoint of endpoints) {
        if (requestsInWindow === 20) {
          // Respect the brapi key's observed limit of 20 requests per minute.
          const elapsed = Date.now() - requestWindowStartedAt;
          if (elapsed < 61_000) await dependencies.delay(61_000 - elapsed);
          requestWindowStartedAt = Date.now();
          requestsInWindow = 0;
        }
        result.requestCount += 1;
        requestsInWindow += 1;

        try {
          payloads[endpoint] = await fetchEndpoint(config, dependencies.fetcher, symbol, endpoint);
        } catch (error) {
          const message = getErrorMessage(error).replace(/\s+/g, ' ').slice(0, 300);
          const detail = `${symbol} ${endpoint}: ${message}`;
          tickerFailures.push(detail);
          result.failures.push(detail);
          if (error instanceof ProviderError && error.status === 429) {
            await dependencies.delay(error.retryAfterMilliseconds ?? 61_000);
            requestWindowStartedAt = Date.now();
            requestsInWindow = 0;
          }
        }
      }

      if (Object.keys(payloads).length > 0) tickersWithData += 1;
      const dataWarnings = await upsertTickerData(
        dependencies,
        symbol,
        payloads,
        dependencies.now().toISOString(),
        tickerFailures,
      );
      result.failures.push(...dataWarnings);
      if (tickerFailures.length === 0 && dataWarnings.length === 0) {
        result.succeededCount += 1;
      }
    }

    result.status =
      result.succeededCount === result.requestedCount
        ? 'succeeded'
        : tickersWithData > 0
          ? 'partial'
          : 'failed';
    await updateJobRun(dependencies, runId, result);
    return result;
  } catch (error) {
    const detail = getErrorMessage(error).replace(/\s+/g, ' ').slice(0, 1000);
    result.status = 'failed';
    result.failures.push(detail);
    await updateJobRun(dependencies, runId, result);
    return result;
  }
}
