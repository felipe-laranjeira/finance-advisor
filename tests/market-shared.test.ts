import assert from 'node:assert/strict';
import test from 'node:test';
import {
  constantTimeEqual,
  databaseRequest,
  readMarketRuntimeConfig,
} from '../supabase/functions/_shared/market.ts';

test('loads server-side configuration and compares the job secret safely', () => {
  const config = readMarketRuntimeConfig((name) => {
    const values: Record<string, string> = {
      SUPABASE_URL: 'https://supabase.example/',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role',
      BRAPI_API_KEY: 'test-brapi-key',
      MARKET_JOB_SECRET: 'test-job-secret',
    };
    return values[name];
  });

  assert.equal(config.supabaseUrl, 'https://supabase.example');
  assert.equal(constantTimeEqual('same-secret', 'same-secret'), true);
  assert.equal(constantTimeEqual('same-secret', 'different'), false);
  assert.throws(
    () => readMarketRuntimeConfig(() => undefined),
    /Missing required Edge Function secrets/,
  );
});

test('uses the service role only in server-side Supabase REST requests', async () => {
  let authorization = '';
  let apiKey = '';
  let requestedUrl = '';
  const result = await databaseRequest<{ ok: boolean }>(
    {
      supabaseUrl: 'https://supabase.example',
      serviceRoleKey: 'service-role-test-only',
      brapiApiKey: 'brapi-test-only',
      jobSecret: 'job-secret-test-only',
    },
    'fundamentals_latest?select=ticker',
    {},
    async (input, init) => {
      requestedUrl = input.toString();
      const headers = new Headers(init?.headers);
      authorization = headers.get('Authorization') ?? '';
      apiKey = headers.get('apikey') ?? '';
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  );

  assert.equal(requestedUrl, 'https://supabase.example/rest/v1/fundamentals_latest?select=ticker');
  assert.equal(authorization, 'Bearer service-role-test-only');
  assert.equal(apiKey, 'service-role-test-only');
  assert.deepEqual(result, { ok: true });
});

test('preserves PostgREST error codes and messages for job diagnostics', async () => {
  await assert.rejects(
    databaseRequest(
      {
        supabaseUrl: 'https://supabase.example',
        serviceRoleKey: 'service-role-test-only',
        brapiApiKey: 'brapi-test-only',
        jobSecret: 'job-secret-test-only',
      },
      'fundamentals_latest?on_conflict=ticker',
      { method: 'POST' },
      async () =>
        new Response(
          JSON.stringify({
            code: 'PGRST204',
            message: "Column 'financial_institution_type' was not found.",
            hint: 'Check the schema cache.',
          }),
          { status: 400 },
        ),
    ),
    /Supabase POST fundamentals_latest\?on_conflict=ticker failed with status 400: PGRST204: Column 'financial_institution_type' was not found\.: Check the schema cache\./,
  );
});
