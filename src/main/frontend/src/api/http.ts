import { ApiError } from './ApiError';

const BASE = '/api/v1';

/** Spring's defaults: the cookie it writes, and the header it expects back. */
const CSRF_COOKIE = 'XSRF-TOKEN';
const CSRF_HEADER = 'X-XSRF-TOKEN';

/**
 * Sign-in has its own 401 — wrong password — which is a form error, not an expired session.
 * Routing it through the session-expiry path would bounce the practitioner to the login screen
 * they are already looking at and lose what they typed.
 */
const LOGIN_PATH = '/auth/login';

type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

/**
 * Called when the server says the session is gone. Sessions here are server-side and revocable,
 * so this is a normal event — a timeout, a sign-out elsewhere, an administrator revoking access —
 * not an error condition.
 */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/**
 * Spring Security 6 defers CSRF token generation until something asks for it, so the cookie does
 * not exist until the server has answered at least one request in this session. A first write
 * after a hard reload can therefore find no token. One cheap GET materialises it.
 */
async function ensureCsrfToken(): Promise<string | null> {
  const existing = readCookie(CSRF_COOKIE);
  if (existing) {
    return existing;
  }
  await fetch('/actuator/health', { credentials: 'same-origin' }).catch(() => undefined);
  return readCookie(CSRF_COOKIE);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

function urlFor(path: string, query: RequestOptions['query']): string {
  const url = new URL(BASE + path, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.pathname + url.search;
}

async function send(path: string, options: RequestOptions, csrf: string | null): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (csrf) {
    headers[CSRF_HEADER] = csrf;
  }

  return fetch(urlFor(path, options.query), {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    // Session and CSRF cookies both travel on this. Stated rather than left to the default,
    // because the default has changed before.
    credentials: 'same-origin',
    signal: options.signal,
  });
}

/**
 * One request. Returns parsed JSON, or `undefined` for a 204.
 *
 * Every failure — HTTP status, network fault, unparseable body — arrives as an {@link ApiError}.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const isWrite = options.method !== undefined && options.method !== 'GET';
  const csrf = isWrite ? await ensureCsrfToken() : null;

  let response: Response;
  try {
    response = await send(path, options, csrf);
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      throw cause;
    }
    // fetch rejects only when the request never completed: offline, DNS, TLS, connection reset.
    throw new ApiError(0, 'Network request failed');
  }

  // A 403 on a write is usually a CSRF token that no longer matches — the session was rotated,
  // or the tab sat idle while another tab signed in. Nothing ran: Spring rejects in the filter
  // chain, before the controller. So a single retry cannot duplicate a write, and it is only
  // attempted when the token actually changed, which keeps a genuine access denial to one round.
  if (response.status === 403 && isWrite) {
    const refreshed = readCookie(CSRF_COOKIE);
    if (refreshed && refreshed !== csrf) {
      response = await send(path, options, refreshed);
    }
  }

  if (!response.ok) {
    const error = await ApiError.fromResponse(response);
    if (error.isUnauthenticated && path !== LOGIN_PATH) {
      sessionExpiredListeners.forEach((listener) => listener());
    }
    throw error;
  }

  if (response.status === 204 || response.headers.get('Content-Length') === '0') {
    return undefined as T;
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(response.status, 'Server returned a malformed response');
  }
}

/**
 * A binary download — the plan PDF. Returns the blob and the filename the server chose, which
 * carries the client's name and the plan dates and is not reconstructible on this side.
 */
export async function requestBlob(
  path: string,
  query?: RequestOptions['query'],
): Promise<{ blob: Blob; filename: string | null }> {
  let response: Response;
  try {
    response = await fetch(urlFor(path, query), {
      headers: { Accept: 'application/pdf' },
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, 'Network request failed');
  }

  if (!response.ok) {
    const error = await ApiError.fromResponse(response);
    if (error.isUnauthenticated) {
      sessionExpiredListeners.forEach((listener) => listener());
    }
    throw error;
  }

  return { blob: await response.blob(), filename: filenameFrom(response) };
}

/**
 * Reads the filename from Content-Disposition, preferring the RFC 5987 `filename*` form. Plan
 * exports are named after the client, so the value is Greek and percent-encoded; the plain
 * `filename` fallback is the mangled one and is only used when there is nothing better.
 */
function filenameFrom(response: Response): string | null {
  const header = response.headers.get('Content-Disposition');
  if (!header) {
    return null;
  }

  const extended = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (extended?.[1]) {
    try {
      return decodeURIComponent(extended[1]);
    } catch {
      // Fall through to the plain form rather than losing the download over a bad encoding.
    }
  }

  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1] ?? null;
}
