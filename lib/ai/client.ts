'use client';

import { supabase } from '@/lib/supabase';

export class AiRequestError extends Error {
  constructor(public readonly status: number) {
    super(status === 429 ? 'rate-limited' : 'unavailable');
  }
}

export async function requestAi<T>(path: string, payload: unknown): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new AiRequestError(401);

  let result: Response;
  try {
    result = await fetch(path, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
  } catch {
    throw new AiRequestError(503);
  }

  if (!result.ok) throw new AiRequestError(result.status);
  const body: { data?: T } = await result.json();
  if (body.data === undefined) throw new AiRequestError(502);
  return body.data;
}

export function aiErrorMessage(error: unknown) {
  if (error instanceof AiRequestError && error.status === 429) {
    return 'Limite de uso atingido. Tente novamente em alguns minutos.';
  }
  return 'Recurso temporariamente indisponível.';
}
