import {
  constantTimeEqual,
  databaseRequest as requestDatabase,
  jsonResponse,
  readMarketRuntimeConfig,
} from '../_shared/market.ts';

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Promise<Response>): void;
};

type TickerRow = {
  symbol: string;
  company_id: string;
};

type BrapiQuote = {
  requestedSymbol?: string;
  symbol?: string;
  data?: {
    regularMarketPrice?: number;
    regularMarketTime?: string;
    logourl?: string | null;
  };
};

type BrapiResponse = {
  results?: BrapiQuote[];
};

const jobName = 'daily-market-snapshot';
const timezone = 'America/Sao_Paulo';

function getMarketDate(date: Date): { date: string; year: number; weekday: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  const year = part('year');
  const month = part('month');
  const day = part('day');
  const weekday = part('weekday');

  if (!year || !month || !day || !weekday) {
    throw new Error('Could not determine the Sao Paulo market date.');
  }

  return { date: `${year}-${month}-${day}`, year: Number(year), weekday };
}

function decimalPrice(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error('The quote did not contain a valid positive market price.');
  }

  return value.toFixed(4);
}

function timestampOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function getRuntimeConfig() {
  return readMarketRuntimeConfig((name) => Deno.env.get(name));
}

const databaseRequest = <T>(
  config: ReturnType<typeof getRuntimeConfig>,
  path: string,
  init: RequestInit = {},
): Promise<T> => requestDatabase<T>(config, path, init);

async function saveJobRun(
  config: ReturnType<typeof getRuntimeConfig>,
  runId: string,
  values: {
    status: string;
    completedAt: string;
    requestedCount: number;
    succeededCount: number;
    requestCount: number;
    detail: string | null;
  },
): Promise<void> {
  await databaseRequest<void>(config, `job_runs?id=eq.${runId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      status: values.status,
      completed_at: values.completedAt,
      requested_count: values.requestedCount,
      succeeded_count: values.succeededCount,
      request_count: values.requestCount,
      detail: values.detail,
    }),
  });
}

async function markPriceStale(
  config: ReturnType<typeof getRuntimeConfig>,
  ticker: string,
  checkedAt: string,
): Promise<void> {
  await databaseRequest<void>(
    config,
    `prices_latest?ticker=eq.${encodeURIComponent(ticker)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ is_stale: true, last_checked_at: checkedAt }),
    },
  );
}

async function runSnapshot(config: ReturnType<typeof getRuntimeConfig>): Promise<Response> {
  const startedAt = new Date();
  const runId = crypto.randomUUID();
  const snapshotDate = getMarketDate(startedAt).date;
  const startedAtIso = startedAt.toISOString();

  await databaseRequest<void>(config, 'job_runs', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: runId,
      job_name: jobName,
      status: 'running',
      started_at: startedAtIso,
    }),
  });

  try {
    const tickers = await databaseRequest<TickerRow[]>(
      config,
      'tickers?select=symbol,company_id&is_active=eq.true&exchange=eq.B3&order=display_order.asc,symbol.asc',
    );

    if (tickers.length === 0) {
      throw new Error('No active B3 tickers are configured.');
    }

    let succeededCount = 0;
    let requestCount = 0;
    const failures: string[] = [];

    for (const { symbol, company_id } of tickers) {
      requestCount += 1;
      const fetchedAt = new Date().toISOString();

      try {
        const quoteUrl = new URL('https://brapi.dev/api/v2/stocks/quote');
        quoteUrl.searchParams.set('symbols', symbol);

        const response = await fetch(quoteUrl, {
          headers: { Authorization: `Bearer ${config.brapiApiKey}` },
        });

        if (!response.ok) {
          throw new Error(`brapi returned HTTP ${response.status}.`);
        }

        const payload = (await response.json()) as BrapiResponse;
        const quote = payload.results?.find(
          (item) => item.requestedSymbol === symbol || item.symbol === symbol,
        );
        if (!quote?.data) {
          throw new Error('brapi returned no quote for the requested ticker.');
        }

        const price = decimalPrice(quote.data.regularMarketPrice);
        const quoteAt = timestampOrNull(quote.data.regularMarketTime);

        const latestPrice = {
          ticker: symbol,
          price,
          quote_at: quoteAt,
          fetched_at: fetchedAt,
          last_checked_at: fetchedAt,
          is_stale: false,
          provider: 'brapi',
        };

        await databaseRequest<void>(config, 'prices_latest?on_conflict=ticker', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(latestPrice),
        });

        if (quoteAt) {
          const marketDate = getMarketDate(new Date(quoteAt)).date;
          await databaseRequest<void>(config, 'prices_daily?on_conflict=ticker,market_date', {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify({
              ticker: symbol,
              market_date: marketDate,
              price,
              quote_at: quoteAt,
              fetched_at: fetchedAt,
              provider: 'brapi',
            }),
          });
        }

        if (quote.data.logourl) {
          try {
            const logoUrl = new URL(quote.data.logourl);
            if (logoUrl.protocol !== 'https:' || logoUrl.hostname !== 'icons.brapi.dev') {
              throw new Error('brapi returned a logo URL outside the approved host.');
            }

            await databaseRequest<void>(
              config,
              `companies?id=eq.${encodeURIComponent(company_id)}`,
              {
                method: 'PATCH',
                headers: { Prefer: 'return=minimal' },
                body: JSON.stringify({ logo_url: logoUrl.toString() }),
              },
            );
          } catch (error) {
            const detail = error instanceof Error ? error.message : 'Unexpected logo update error.';
            failures.push(`${symbol} logo: ${detail}`);
          }
        }

        succeededCount += 1;
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Unexpected ticker processing error.';
        failures.push(`${symbol}: ${detail}`);
        await markPriceStale(config, symbol, fetchedAt);
      }
    }

    const status =
      failures.length === 0 && succeededCount === tickers.length
        ? 'succeeded'
        : succeededCount > 0
          ? 'partial'
          : 'failed';
    const detail = failures.length > 0 ? failures.join('; ').slice(0, 4000) : null;

    await saveJobRun(config, runId, {
      status,
      completedAt: new Date().toISOString(),
      requestedCount: tickers.length,
      succeededCount,
      requestCount,
      detail,
    });

    return jsonResponse({
      status,
      snapshotDate,
      requestedCount: tickers.length,
      succeededCount,
      requestCount,
      failures,
    }, status === 'failed' ? 502 : 200);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unexpected market snapshot error.';

    await saveJobRun(config, runId, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      requestedCount: 0,
      succeededCount: 0,
      requestCount: 0,
      detail: detail.slice(0, 4000),
    });

    return jsonResponse({ status: 'failed', detail }, 500);
  }
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  let config: ReturnType<typeof getRuntimeConfig>;
  try {
    config = getRuntimeConfig();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Invalid runtime configuration.');
    return jsonResponse({ error: 'The market job is not configured.' }, 500);
  }

  const suppliedSecret = request.headers.get('x-market-job-secret') ?? '';
  if (!constantTimeEqual(suppliedSecret, config.jobSecret)) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  try {
    return await runSnapshot(config);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Unexpected market job failure.');
    return jsonResponse({ error: 'The market job could not be completed.' }, 500);
  }
});
