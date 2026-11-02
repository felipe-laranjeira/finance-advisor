import { executeFundamentalsSnapshot } from '../_shared/fundamentals-job.ts';
import {
  constantTimeEqual,
  databaseRequest,
  jsonResponse,
  readMarketRuntimeConfig,
} from '../_shared/market.ts';

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Promise<Response>): void;
};

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  let config;
  try {
    config = readMarketRuntimeConfig((name) => Deno.env.get(name));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Invalid runtime configuration.');
    return jsonResponse({ error: 'The fundamentals job is not configured.' }, 500);
  }

  const suppliedSecret = request.headers.get('x-market-job-secret') ?? '';
  if (!constantTimeEqual(suppliedSecret, config.jobSecret)) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  try {
    const result = await executeFundamentalsSnapshot(config, {
      databaseRequest: <T>(path: string, init?: RequestInit) =>
        databaseRequest<T>(config, path, init),
      fetcher: fetch,
      delay: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
      now: () => new Date(),
    });

    return jsonResponse(result, result.status === 'failed' ? 502 : 200);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Unexpected fundamentals job failure.');
    return jsonResponse({ error: 'The fundamentals job could not be completed.' }, 500);
  }
});
