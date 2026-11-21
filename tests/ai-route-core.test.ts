import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import {
  AiConfigurationError,
  AiLimitError,
  executeAiRequest,
} from '../lib/ai/route-core.ts';

const requestSchema = z.object({
  value: z.string().min(1).max(5),
}).strict();
type Auth = { userId: string };
type Dependencies = {
  authenticate: (request: Request) => Promise<Auth | null>;
  assertConfigured: () => void;
  consumeUsage: (auth: Auth) => Promise<void>;
  handler: (context: { body: z.infer<typeof requestSchema>; auth: Auth }) => Promise<unknown>;
};

function request(body: unknown) {
  return new Request('http://localhost/api/ai/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function dependencies(
  authenticate: (request: Request) => Promise<Auth | null>,
  handler: Dependencies['handler'],
): Dependencies {
  return {
    authenticate,
    assertConfigured: () => {},
    consumeUsage: async (_auth) => {},
    handler,
  };
}

test('unauthenticated requests are denied before usage accounting or provider calls', async () => {
  let usageCalls = 0;
  let providerCalls = 0;
  const deps = dependencies(async () => null, async () => {
    providerCalls++;
    return 'unexpected';
  });
  deps.consumeUsage = async () => { usageCalls++; };

  const result = await executeAiRequest(request({ value: 'valid' }), requestSchema, deps);
  assert.equal(result.status, 401);
  assert.equal(usageCalls, 0);
  assert.equal(providerCalls, 0);
});

test('strict schemas reject unknown, oversized, and wrongly typed fields before usage accounting', async () => {
  let usageCalls = 0;
  const deps = dependencies(async () => ({ userId: 'user-a' }), async () => 'unexpected');
  deps.consumeUsage = async () => { usageCalls++; };

  const unknown = await executeAiRequest(
    request({ value: 'valid', prompt: 'client-controlled' }),
    requestSchema,
    deps,
  );
  const oversized = await executeAiRequest(
    request({ value: '123456' }),
    requestSchema,
    deps,
  );
  const wrongType = await executeAiRequest(
    request({ value: 123 }),
    requestSchema,
    deps,
  );
  assert.equal(unknown.status, 400);
  assert.equal(oversized.status, 400);
  assert.equal(wrongType.status, 400);
  assert.equal(usageCalls, 0);
});

test('JSON body size is bounded before parsing', async () => {
  let usageCalls = 0;
  const deps = dependencies(async () => ({ userId: 'user-a' }), async () => 'unexpected');
  deps.consumeUsage = async () => { usageCalls++; };
  const oversized = new Request('http://localhost/api/ai/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': '6000000',
    },
    body: '{"value":"valid"}',
  });

  const result = await executeAiRequest(oversized, requestSchema, deps);
  assert.equal(result.status, 400);
  assert.equal(usageCalls, 0);
});

test('authenticated requests pass validated structured input and return uncached results', async () => {
  let providerCalls = 0;
  const deps = dependencies(async () => ({ userId: 'user-a' }), async ({ body, auth }) => {
    providerCalls++;
    assert.equal(body.value, 'valid');
    assert.equal(auth.userId, 'user-a');
    return { answer: 'server prompt result' };
  });

  const result = await executeAiRequest(request({ value: 'valid' }), requestSchema, deps);
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('Cache-Control'), 'private, no-store, max-age=0');
  assert.deepEqual(await result.json(), { data: { answer: 'server prompt result' } });
  assert.equal(providerCalls, 1);
});

test('usage limits are isolated per authenticated user', async () => {
  const usage = new Map<string, number>();
  const deps = dependencies(async (incoming) => ({
    userId: incoming.headers.get('x-user') || 'user-a',
  }), async ({ auth }) => auth.userId);
  deps.consumeUsage = async (auth) => {
    const calls = usage.get(auth.userId) ?? 0;
    if (calls >= 1) throw new AiLimitError();
    usage.set(auth.userId, calls + 1);
  };

  const firstUser = await executeAiRequest(request({ value: 'valid' }), requestSchema, deps);
  const secondRequest = request({ value: 'valid' });
  secondRequest.headers.set('x-user', 'user-b');
  const secondUser = await executeAiRequest(secondRequest, requestSchema, deps);
  const limitedUser = await executeAiRequest(request({ value: 'valid' }), requestSchema, deps);
  assert.equal(firstUser.status, 200);
  assert.equal(secondUser.status, 200);
  assert.equal(limitedUser.status, 429);
  assert.equal(limitedUser.headers.get('Retry-After'), '60');
});

test('provider failures and missing configuration never leak internal details', async () => {
  const failingProvider = dependencies(async () => ({ userId: 'user-a' }), async () => {
    throw new Error('private provider response');
  });
  const providerResponse = await executeAiRequest(
    request({ value: 'valid' }),
    requestSchema,
    failingProvider,
  );
  assert.equal(providerResponse.status, 502);
  assert.doesNotMatch(await providerResponse.text(), /private provider response/);

  let providerCalls = 0;
  const missingConfiguration = dependencies(async () => ({ userId: 'user-a' }), async () => {
    providerCalls++;
    return 'unexpected';
  });
  missingConfiguration.assertConfigured = () => { throw new AiConfigurationError(); };
  const missingResponse = await executeAiRequest(
    request({ value: 'valid' }),
    requestSchema,
    missingConfiguration,
  );
  assert.equal(missingResponse.status, 503);
  assert.doesNotMatch(await missingResponse.text(), /GEMINI_API_KEY|private/);
  assert.equal(providerCalls, 0);
});
