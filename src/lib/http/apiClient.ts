/**
 * The HTTP client for the InRange backend.
 *
 * The ONLY file that calls fetch(). Services in src/services/ call apiRequest(); pages and
 * components call services. This keeps the base URL, auth header and error handling in one place.
 *
 * The backend answers `{ success, message, data }`. apiRequest returns the whole parsed body
 * (some endpoints put fields beside `data`, e.g. `sessionId`), and throws ApiError when the
 * HTTP status is not 2xx or `success` is false.
 */

import { API_BASE_URL } from "@/config/env";
import { clearSession, getAccessToken } from "@/lib/session/authSession";

/** The usual backend response shape. Endpoints may add extra top-level fields. */
export type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  error?: string;
  data?: T;
};

/** Fired on window after every successful write, so screens that count work (the doctor's badges) refresh. */
export const DATA_CHANGED_EVENT = "inrange:data-changed";

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  /** True when the endpoint does not exist yet on the backend (see docs/backend/). */
  get isMissingEndpoint() {
    return this.status === 404;
  }

  get isUnauthorised() {
    return this.status === 401;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** A plain object is sent as JSON; FormData is sent as multipart (file uploads). */
  body?: unknown;
  /** Query string values; undefined and empty values are skipped. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Send the access token. Default true. */
  authenticated?: boolean;
  signal?: AbortSignal;
};

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const url = new URL(`${API_BASE_URL}${path}`);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "")
      url.searchParams.set(key, String(value));
  });
  return url.toString();
}

/** The sentence to show for a failed request: the backend's own message, else one by status. */
function isNotAuthorisedBody(body: unknown) {
  if (!body || typeof body !== "object") return false;
  const error = String((body as { error?: unknown }).error ?? "").toUpperCase();
  return (
    error === "NOT_AUTHORISED" ||
    error === "NOT_AUTHORIZED" ||
    error === "NOT_AUTHENTICATED"
  );
}

function messageFrom(body: unknown, status: number) {
  if (body && typeof body === "object") {
    const fields = body as { message?: unknown; error?: unknown };
    if (typeof fields.message === "string" && fields.message)
      return fields.message;
    if (typeof fields.error === "string" && fields.error) return fields.error;
  }
  // a short plain-text reason is shown; an HTML error page (e.g. Express "Cannot GET") never is
  if (
    typeof body === "string" &&
    body &&
    body.length < 200 &&
    !body.trimStart().startsWith("<")
  )
    return body;
  if (status === 404) return "This feature is not available yet.";
  if (status === 401) return "Your session has ended. Please sign in again.";
  return "Something went wrong. Please try again.";
}

export async function apiRequest<TBody = ApiEnvelope<unknown>>(
  path: string,
  options: RequestOptions = {},
): Promise<TBody> {
  const { method = "GET", body, query, authenticated = true, signal } = options;
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  // run the API in Mumbai, beside the database, wherever the person is (Supabase regional invocation)
  const headers: Record<string, string> = {
    Accept: "application/json",
    "x-region": "ap-south-1",
  };
  if (body !== undefined && !isFormData)
    headers["Content-Type"] = "application/json";
  const token = authenticated ? getAccessToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  const send = () =>
    fetch(buildUrl(path, query), {
      method,
      headers,
      body:
        body === undefined
          ? undefined
          : isFormData
            ? (body as FormData)
            : JSON.stringify(body),
      signal,
      cache: "no-store",
    });
  let response: Response;
  try {
    // a read that got no answer, or a gateway error (502 to 504), is a brief platform blip: it is safe
    // to try once more. A write is never repeated.
    const retry = async () => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      return send();
    };
    response = await send().catch((firstError: Error) => {
      if (method !== "GET" || firstError.name === "AbortError")
        throw firstError;
      return retry();
    });
    if (method === "GET" && [502, 503, 504].includes(response.status))
      response = await retry();
  } catch (networkError) {
    if ((networkError as Error).name === "AbortError") throw networkError;
    throw new ApiError(
      "Cannot reach InRange. Check your connection and try again.",
      0,
      null,
    );
  }

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  const failedBySuccessFlag =
    parsed !== null &&
    typeof parsed === "object" &&
    (parsed as ApiEnvelope<unknown>).success === false;
  // the backend answers a missing or expired sign-in with HTTP 200 and error "NOT_AUTHORISED"; treat it as a 401
  const notAuthorised = response.status === 401 || isNotAuthorisedBody(parsed);
  if (notAuthorised) {
    if (token) clearSession();
    throw new ApiError(
      "Your session has ended. Please sign in again.",
      401,
      parsed,
    );
  }
  if (!response.ok || failedBySuccessFlag) {
    throw new ApiError(
      messageFrom(parsed, response.status),
      response.status,
      parsed,
    );
  }
  if (method !== "GET" && typeof window !== "undefined")
    window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
  return parsed as TBody;
}

/** Turns any thrown value into a sentence a patient or doctor can read. */
export function errorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
) {
  if (error instanceof ApiError || error instanceof Error)
    return error.message || fallback;
  return fallback;
}

/**
 * Many list endpoints answer either `[...]`, `{ data: [...] }` or `{ data: { <key>: [...] } }`.
 * Returns the array wherever it is, or [] if there is none.
 */
export function listFrom<T>(body: unknown, nestedKey?: string): T[] {
  if (Array.isArray(body)) return body as T[];
  if (body && typeof body === "object") {
    const data = (body as ApiEnvelope<unknown>).data;
    if (Array.isArray(data)) return data as T[];
    if (nestedKey && data && typeof data === "object") {
      const nested = (data as Record<string, unknown>)[nestedKey];
      if (Array.isArray(nested)) return nested as T[];
    }
    if (nestedKey) {
      const topLevel = (body as Record<string, unknown>)[nestedKey];
      if (Array.isArray(topLevel)) return topLevel as T[];
    }
  }
  return [];
}

/**
 * Runs a request and answers null instead of throwing when the backend does not have the endpoint
 * yet (404), so a screen can show a calm "not available yet". Any other failure still throws.
 */
export async function nullWhenMissing<T>(
  load: () => Promise<T>,
): Promise<T | null> {
  try {
    return await load();
  } catch (caught) {
    if (caught instanceof ApiError && caught.isMissingEndpoint) return null;
    throw caught;
  }
}
