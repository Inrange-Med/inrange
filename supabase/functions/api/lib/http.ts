// The response envelope the app expects: { success, message, data } and errors as { success: false, message }.
// Throw `new HttpError(400, "A sentence a patient can read.")` anywhere; index.ts turns it into JSON.
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export class HttpError extends Error {
  constructor(readonly status: ContentfulStatusCode, message: string, readonly code?: string) {
    super(message);
  }
}

export const ok = (c: Context, data: unknown = null, message = "OK", extra: Record<string, unknown> = {}) =>
  c.json({ success: true, message, data, ...extra });

export const fail = (status: ContentfulStatusCode, message: string, code?: string): never => {
  throw new HttpError(status, message, code);
};

/** Reads a JSON body; an empty or invalid body becomes {}. */
export async function body<T = Record<string, unknown>>(c: Context): Promise<T> {
  try {
    return (await c.req.json()) as T;
  } catch {
    return {} as T;
  }
}

/** Integer path/query param or a 400. */
export function intParam(value: string | undefined, name = "id"): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) fail(400, `That ${name} is not valid.`);
  return n;
}

/** India-time today as YYYY-MM-DD. */
export function todayIST(): string {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
}
