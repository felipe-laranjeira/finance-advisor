import type { ZodType } from 'zod';

const MAX_JSON_BYTES = 5_500_000;

export class AiLimitError extends Error {}
export class AiUnavailableError extends Error {}
export class AiConfigurationError extends Error {}
class InvalidJsonError extends Error {}
class OversizedBodyError extends Error {}

type AiRequestDependencies<T, A, R> = {
  authenticate: (request: Request) => Promise<A | null>;
  assertConfigured: () => void;
  consumeUsage: (auth: A) => Promise<void>;
  handler: (context: { body: T; auth: A }) => Promise<R>;
};

function response(body: Record<string, unknown>, status: number, headers?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      ...headers,
    },
  });
}

async function readJsonBody(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new InvalidJsonError();
  }

  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BYTES) {
    throw new OversizedBodyError();
  }

  if (!request.body) throw new InvalidJsonError();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_JSON_BYTES) {
      await reader.cancel();
      throw new OversizedBodyError();
    }
    chunks.push(value);
  }

  try {
    const body = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  } catch {
    throw new InvalidJsonError();
  }
}

export async function executeAiRequest<T, A, R>(
  request: Request,
  schema: ZodType<T>,
  dependencies: AiRequestDependencies<T, A, R>,
): Promise<Response> {
  let auth: A | null;
  try {
    auth = await dependencies.authenticate(request);
  } catch {
    return response({ error: 'Serviço temporariamente indisponível.' }, 503);
  }
  if (!auth) return response({ error: 'Autenticação necessária.' }, 401);

  try {
    const parsed = schema.safeParse(await readJsonBody(request));
    if (!parsed.success) return response({ error: 'Dados inválidos.' }, 400);
    dependencies.assertConfigured();
    await dependencies.consumeUsage(auth);
    const result = await dependencies.handler({ body: parsed.data, auth });
    return response({ data: result }, 200);
  } catch (error) {
    if (error instanceof InvalidJsonError || error instanceof OversizedBodyError) {
      return response({ error: 'Dados inválidos.' }, 400);
    }
    if (error instanceof AiLimitError) {
      return response(
        { error: 'Limite de uso atingido. Tente novamente em alguns minutos.' },
        429,
        { 'Retry-After': '60' },
      );
    }
    if (error instanceof AiConfigurationError || error instanceof AiUnavailableError) {
      return response({ error: 'Serviço temporariamente indisponível.' }, 503);
    }
    console.error('AI request handler failed.', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    return response({ error: 'Serviço temporariamente indisponível.' }, 502);
  }
}
