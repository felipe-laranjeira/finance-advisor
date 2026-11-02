export type MarketRuntimeConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  brapiApiKey: string;
  jobSecret: string;
};

export function readMarketRuntimeConfig(
  readEnv: (name: string) => string | undefined,
): MarketRuntimeConfig {
  const supabaseUrl = readEnv('SUPABASE_URL');
  const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');
  const brapiApiKey = readEnv('BRAPI_API_KEY');
  const jobSecret = readEnv('MARKET_JOB_SECRET');

  if (!supabaseUrl || !serviceRoleKey || !brapiApiKey || !jobSecret) {
    throw new Error('Missing required Edge Function secrets or Supabase runtime configuration.');
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/+$/, ''),
    serviceRoleKey,
    brapiApiKey,
    jobSecret,
  };
}

export function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

export async function databaseRequest<T>(
  config: MarketRuntimeConfig,
  path: string,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('apikey', config.serviceRoleKey);
  headers.set('Authorization', `Bearer ${config.serviceRoleKey}`);
  headers.set('Content-Type', 'application/json');

  const response = await fetcher(`${config.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const body = await response.text();
    let diagnostic = '';
    try {
      const payload: unknown = JSON.parse(body);
      if (typeof payload === 'object' && payload !== null) {
        const error = payload as Record<string, unknown>;
        const code = typeof error.code === 'string' ? error.code : undefined;
        const message = typeof error.message === 'string' ? error.message : undefined;
        const hint = typeof error.hint === 'string' ? error.hint : undefined;
        diagnostic = [code, message, hint].filter(Boolean).join(': ').slice(0, 1000);
      }
    } catch {
      diagnostic = '';
    }

    const method = init.method ?? 'GET';
    const suffix = diagnostic ? `: ${diagnostic}` : '';
    throw new Error(
      `Supabase ${method} ${path} failed with status ${response.status}${suffix}.`,
    );
  }

  const responseBody = await response.text();
  if (!responseBody) return undefined as T;
  return JSON.parse(responseBody) as T;
}
