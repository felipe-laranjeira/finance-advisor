import assert from 'node:assert/strict';
import test from 'node:test';
import {
  executeFundamentalsSnapshot,
  type FundamentalsJobDependencies,
} from '../supabase/functions/_shared/fundamentals-job.ts';
import type { MarketRuntimeConfig } from '../supabase/functions/_shared/market.ts';

type JsonRecord = Record<string, unknown>;

const config: MarketRuntimeConfig = {
  supabaseUrl: 'https://supabase.example',
  serviceRoleKey: 'service-role-test-only',
  brapiApiKey: 'brapi-test-only',
  jobSecret: 'job-secret-test-only',
};

class FakeDatabase {
  readonly latest = new Map<string, JsonRecord>();
  readonly annual = new Map<string, JsonRecord>();
  readonly dividends = new Map<string, JsonRecord>();
  readonly runs = new Map<string, JsonRecord>();

  readonly request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? JSON.parse(init.body) as unknown : undefined;

    if (path.startsWith('tickers?select=')) {
      return [{ symbol: 'TEST3' }] as T;
    }

    if (path === 'job_runs' && method === 'POST' && isRecord(body)) {
      this.runs.set(String(body.id), body);
      return undefined as T;
    }

    if (path.startsWith('job_runs?id=eq.') && method === 'PATCH' && isRecord(body)) {
      const id = decodeURIComponent(path.slice('job_runs?id=eq.'.length));
      const current = this.runs.get(id);
      if (!current) throw new Error('Job run was not created before it was updated.');
      this.runs.set(id, { ...current, ...body });
      return undefined as T;
    }

    if (path.startsWith('fundamentals_latest?select=')) {
      const ticker = new URLSearchParams(path.split('?')[1]).get('ticker')?.replace('eq.', '');
      const existing = ticker ? this.latest.get(ticker) : undefined;
      return (existing ? [existing] : []) as T;
    }

    if (path.startsWith('financials_annual?select=')) {
      const ticker = new URLSearchParams(path.split('?')[1]).get('ticker')?.replace('eq.', '');
      const rows = [...this.annual.values()].filter((row) => row.ticker === ticker);
      return rows as T;
    }

    if (path.startsWith('fundamentals_latest?on_conflict=') && method === 'POST' && isRecord(body)) {
      const ticker = String(body.ticker);
      this.latest.set(ticker, { ...this.latest.get(ticker), ...body });
      return undefined as T;
    }

    if (
      path.startsWith('financials_annual?on_conflict=') &&
      method === 'POST' &&
      Array.isArray(body)
    ) {
      for (const row of body.filter(isRecord)) {
        const key = `${row.ticker}:${row.fiscal_year_end}:${row.consolidation_type}`;
        this.annual.set(key, { ...this.annual.get(key), ...row });
      }
      return undefined as T;
    }

    if (path.startsWith('dividends_history?on_conflict=') && method === 'POST' && Array.isArray(body)) {
      const expectedKeys = Object.keys(body[0] as JsonRecord).sort().join(',');
      assert.ok(
        body.every(
          (row) => isRecord(row) && Object.keys(row).sort().join(',') === expectedKeys,
        ),
        'Each PostgREST batch must contain rows with the same keys.',
      );
      const eventKeys = body.map((row) => (row as JsonRecord).event_key);
      assert.equal(
        new Set(eventKeys).size,
        eventKeys.length,
        'Each PostgREST batch must contain unique conflict keys.',
      );
      for (const row of body.filter(isRecord)) {
        const key = `${row.ticker}:${row.event_key}`;
        this.dividends.set(key, { ...this.dividends.get(key), ...row });
      }
      return undefined as T;
    }

    throw new Error(`Unexpected database request: ${method} ${path}`);
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createDependencies(
  database: FakeDatabase,
  failures = new Map<string, number>(),
  nullEndpoints = new Set<string>(),
): FundamentalsJobDependencies {
  const dataByEndpoint: Record<string, unknown> = {
    statistics: {
      trailingEps: 2,
      bookValue: 10,
      sharesOutstanding: 100,
      mostRecentQuarter: '2026-06-30',
    },
    'financial-data': {
      totalRevenue: 200,
      netIncome: 20,
      ebitda: 50,
      totalDebt: 100,
      totalCash: 30,
      returnOnEquity: 0.2,
      mostRecentQuarter: '2026-06-30',
    },
    'income-statement': [
      {
        endDate: '2025-12-31',
        consolidationType: 'consolidated',
        totalRevenue: 200,
        netIncome: 20,
        costOfRevenue: -100,
        sellingGeneralAdministrative: -20,
        otherOperatingExpenses: -5,
      },
    ],
    'balance-sheet': [
      {
        endDate: '2025-12-31',
        consolidationType: 'consolidated',
        cash: 30,
        totalDebt: 100,
        totalStockholderEquity: 70,
      },
    ],
    dividends: {
      cashDividends: [
        {
          label: 'DIVIDENDO',
          rate: 0.5,
          lastDatePrior: '2026-04-20T03:00:00.000Z',
          exDate: '2026-04-22T03:00:00.000Z',
          paymentDate: '2026-05-01T03:00:00.000Z',
        },
        {
          label: 'DIVIDENDO',
          rate: 0.1,
          lastDatePrior: '2026-04-20T03:00:00.000Z',
          exDate: '2026-04-22T03:00:00.000Z',
          paymentDate: '2026-05-01T03:00:00.000Z',
        },
        {
          label: 'DIVIDENDO',
          rate: 0.1,
          lastDatePrior: '2026-04-20T03:00:00.000Z',
          exDate: '2026-04-22T03:00:00.000Z',
          paymentDate: '2026-05-01T03:00:00.000Z',
        },
        {
          label: 'JCP',
          rate: 0.25,
          lastDatePrior: '2026-04-20T03:00:00.000Z',
        },
      ],
    },
  };

  return {
    databaseRequest: database.request,
    fetcher: async (input, init) => {
      assert.equal(
        new Headers(init?.headers).get('Authorization'),
        `Bearer ${config.brapiApiKey}`,
      );
      const endpoint = new URL(input.toString()).pathname.split('/').pop() ?? '';
      const status = failures.get(endpoint);
      if (status) {
        return new Response(
          JSON.stringify({
            error: true,
            code: status === 429 ? 'RATE_LIMITED' : 'MODULES_NOT_AVAILABLE',
            message: status === 429 ? 'Provider rate limit.' : 'Module not included.',
          }),
          { status },
        );
      }

      const data = nullEndpoints.has(endpoint)
        ? { ...(dataByEndpoint[endpoint] as JsonRecord), trailingEps: null, bookValue: null }
        : dataByEndpoint[endpoint];
      return new Response(
        JSON.stringify({
          results: [
            {
              requestedSymbol: 'TEST3',
              symbol: 'TEST3',
              data,
            },
          ],
        }),
        { status: 200 },
      );
    },
    delay: async () => {},
    now: () => new Date('2026-11-02T12:00:00.000Z'),
  };
}

test('upserts fundamentals, annual statements, dividends, and job runs idempotently', async () => {
  const database = new FakeDatabase();
  const dependencies = createDependencies(database);

  const first = await executeFundamentalsSnapshot(config, dependencies);
  const second = await executeFundamentalsSnapshot(config, dependencies);

  assert.equal(first.status, 'succeeded');
  assert.equal(second.status, 'succeeded');
  assert.equal(first.requestCount, 5);
  assert.equal(database.latest.size, 1);
  assert.equal(database.annual.size, 1);
  assert.equal(database.dividends.size, 2);
  assert.equal(
    database.dividends.get('TEST3:dividend|2026-04-20|2026-04-22|2026-05-01')
      ?.amount_per_share,
    0.6,
  );
  assert.equal(database.runs.size, 2);
  assert.equal(database.latest.get('TEST3')?.eps, 2);
  assert.equal(database.latest.get('TEST3')?.net_debt, 70);
  assert.equal(
    database.dividends.get('TEST3:jcp|2026-04-20||')?.ex_date,
    undefined,
  );
});

test('preserves existing dividend dates when the provider omits them', async () => {
  const database = new FakeDatabase();
  database.dividends.set('TEST3:jcp|2026-04-20||', {
    ticker: 'TEST3',
    event_key: 'jcp|2026-04-20||',
    event_type: 'jcp',
    amount_per_share: 0.25,
    entitlement_date: '2026-04-20',
    ex_date: '2026-04-22',
    payment_date: '2026-05-01',
    raw: {},
    fetched_at: '2026-10-01T00:00:00.000Z',
    provider: 'brapi',
  });

  const result = await executeFundamentalsSnapshot(
    config,
    createDependencies(database),
  );
  const jcp = database.dividends.get('TEST3:jcp|2026-04-20||');

  assert.equal(result.status, 'succeeded');
  assert.equal(jcp?.ex_date, '2026-04-22');
  assert.equal(jcp?.payment_date, '2026-05-01');
});

test('records 403 and 429 per endpoint while retaining the last valid values', async () => {
  const database = new FakeDatabase();
  const success = await executeFundamentalsSnapshot(config, createDependencies(database));
  assert.equal(success.status, 'succeeded');

  const failures = new Map([
    ['statistics', 403],
    ['financial-data', 429],
  ]);
  const partial = await executeFundamentalsSnapshot(
    config,
    createDependencies(database, failures),
  );
  const latest = database.latest.get('TEST3');
  const lastRun = [...database.runs.values()].at(-1);

  assert.equal(partial.status, 'partial');
  assert.equal(partial.requestCount, 5);
  assert.ok(partial.failures.some((failure) => failure.includes('HTTP 403')));
  assert.ok(partial.failures.some((failure) => failure.includes('HTTP 429')));
  assert.equal(latest?.eps, 2);
  assert.equal(latest?.roe, 0.2);
  assert.equal(latest?.is_stale, true);
  assert.match(String(latest?.last_error), /HTTP 403/);
  assert.match(String(lastRun?.detail), /HTTP 429/);
  assert.equal(database.annual.size, 1);
  assert.equal(database.dividends.size, 2);
});

test('preserves valid values and marks them stale when the provider returns nulls', async () => {
  const database = new FakeDatabase();
  await executeFundamentalsSnapshot(config, createDependencies(database));

  const partial = await executeFundamentalsSnapshot(
    config,
    createDependencies(database, new Map(), new Set(['statistics'])),
  );
  const latest = database.latest.get('TEST3');

  assert.equal(partial.status, 'partial');
  assert.equal(latest?.eps, 2);
  assert.equal(latest?.book_value_per_share, 10);
  assert.equal(latest?.is_stale, true);
  assert.match(String(latest?.last_error), /eps, book_value_per_share/);
});
