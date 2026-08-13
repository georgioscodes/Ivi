import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from './ApiError';
import { onSessionExpired, request, requestBlob } from './http';

/**
 * The HTTP boundary. Every call in the application goes through it, so a fault here is a fault
 * everywhere — and the CSRF and session-expiry paths are the two that fail quietly rather than
 * loudly.
 */
describe('request', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    clearCookies();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  function clearCookies(): void {
    for (const pair of document.cookie.split(';')) {
      const name = pair.split('=')[0]?.trim();
      if (name) {
        document.cookie = `${name}=; Max-Age=0; path=/`;
      }
    }
  }

  function headersOf(call: number): Record<string, string> {
    return (fetchMock.mock.calls[call]?.[1] as RequestInit).headers as Record<string, string>;
  }

  it('should not send a CSRF header on a read, because there is nothing to forge', async () => {
    // Given
    document.cookie = 'XSRF-TOKEN=token-abc; path=/';
    fetchMock.mockResolvedValue(jsonResponse({ id: 1 }));

    // When
    await request('/client/1');

    // Then
    expect(headersOf(0)['X-XSRF-TOKEN']).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should echo the CSRF cookie as a header on a write', async () => {
    // Given — Spring writes the cookie, the client echoes it; without this every write is a 403
    document.cookie = 'XSRF-TOKEN=token-abc; path=/';
    fetchMock.mockResolvedValue(jsonResponse({ id: 1 }, 201));

    // When
    await request('/client', { method: 'POST', body: { fullName: 'Ελένη' } });

    // Then
    expect(headersOf(0)['X-XSRF-TOKEN']).toBe('token-abc');
  });

  it('should fetch a CSRF token first, when the cookie does not exist yet', async () => {
    // Given — Spring Security 6 defers token generation, so a first write after a hard reload
    // can find no cookie at all
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes('/actuator/health')) {
        document.cookie = 'XSRF-TOKEN=freshly-minted; path=/';
        return Promise.resolve(jsonResponse({ status: 'UP' }));
      }
      return Promise.resolve(jsonResponse({ id: 1 }, 201));
    });

    // When
    await request('/client', { method: 'POST', body: {} });

    // Then
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(headersOf(1)['X-XSRF-TOKEN']).toBe('freshly-minted');
  });

  it('should retry a write once, when a 403 came with a token that has since changed', async () => {
    // Given — the session rotated while the tab sat idle. Spring rejects in the filter chain,
    // before the controller, so nothing ran and the retry cannot duplicate the write.
    document.cookie = 'XSRF-TOKEN=stale; path=/';
    fetchMock.mockImplementationOnce(() => {
      document.cookie = 'XSRF-TOKEN=rotated; path=/';
      return Promise.resolve(jsonResponse({ message: 'Access denied' }, 403));
    });
    fetchMock.mockResolvedValue(jsonResponse({ id: 7 }, 201));

    // When
    const created = await request<{ id: number }>('/client', { method: 'POST', body: {} });

    // Then
    expect(created.id).toBe(7);
    expect(headersOf(0)['X-XSRF-TOKEN']).toBe('stale');
    expect(headersOf(1)['X-XSRF-TOKEN']).toBe('rotated');
  });

  it('should not retry a 403, when the token is unchanged', async () => {
    // Given — a genuine access denial. Retrying with the same token would repeat the request
    // for a rejection that will be identical.
    document.cookie = 'XSRF-TOKEN=token-abc; path=/';
    fetchMock.mockResolvedValue(jsonResponse({ message: 'Access denied' }, 403));

    // When / Then
    await expect(request('/client', { method: 'POST', body: {} })).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should announce a lost session, so the whole app can react at once', async () => {
    // Given — sessions are server-side and revocable, so this happens mid-use
    const heard = vi.fn();
    const stop = onSessionExpired(heard);
    fetchMock.mockResolvedValue(jsonResponse({ status: 401, message: 'Authentication required' }, 401));

    // When
    await expect(request('/client')).rejects.toBeInstanceOf(ApiError);

    // Then
    expect(heard).toHaveBeenCalledOnce();
    stop();
  });

  it('should not treat a rejected sign-in as an expired session', async () => {
    // Given — a wrong password is a 401 too. Routing it through the expiry path would clear the
    // form and bounce the practitioner to the screen they are already on.
    const heard = vi.fn();
    const stop = onSessionExpired(heard);
    fetchMock.mockResolvedValue(jsonResponse({ status: 401, message: 'Bad credentials' }, 401));

    // When
    await expect(
      request('/auth/login', { method: 'POST', body: { email: 'a@b.gr', password: 'wrong' } }),
    ).rejects.toBeInstanceOf(ApiError);

    // Then
    expect(heard).not.toHaveBeenCalled();
    stop();
  });

  it('should carry field errors through, so a form can mark the inputs that failed', async () => {
    // Given
    fetchMock.mockResolvedValue(
      jsonResponse({ status: 400, message: 'Validation failed', errors: { email: 'Must be a valid email address' } }, 400),
    );

    // When
    const error = await request('/client', { method: 'POST', body: {} }).catch((e: unknown) => e);

    // Then
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).fieldErrors).toEqual({ email: 'Must be a valid email address' });
    expect((error as ApiError).isValidationFailure).toBe(true);
  });

  it('should return nothing for a 204, rather than failing to parse an empty body', async () => {
    // Given — delete and logout both answer this way
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    // When / Then
    await expect(request('/client/1', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('should turn a network failure into an ApiError, not a raw TypeError', async () => {
    // Given — offline, DNS, TLS, connection reset: fetch rejects rather than resolving
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    // When
    const error = await request('/client').catch((e: unknown) => e);

    // Then — one error type at every call site
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
    expect((error as ApiError).isTransient).toBe(true);
  });

  it('should preserve an abort, because a cancelled request is not a failure', async () => {
    // Given — a debounced search supersedes its own in-flight request constantly
    fetchMock.mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'));

    // When
    const error = await request('/food', { query: { name: 'ελ' } }).catch((e: unknown) => e);

    // Then — surfacing this as an error would flash a message on every keystroke
    expect(error).toBeInstanceOf(DOMException);
    expect((error as DOMException).name).toBe('AbortError');
  });

  it('should omit empty query parameters, rather than sending name=', async () => {
    // Given — an empty search box must mean "no filter", not "match the empty string"
    fetchMock.mockResolvedValue(jsonResponse({ content: [] }));

    // When
    await request('/client', { query: { name: '', page: 0, size: 20, sort: undefined } });

    // Then
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/client?page=0&size=20');
  });
});

describe('requestBlob', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should read a Greek filename from the RFC 5987 form', async () => {
    // Given — plan exports are named after the client, so the name is Greek and percent-encoded
    const encoded = encodeURIComponent('Πλάνο - Ελένη Παπαδοπούλου.pdf');
    vi.mocked(fetch).mockResolvedValue(
      new Response(new Blob(['%PDF-1.4']), {
        status: 200,
        headers: {
          'Content-Disposition': `attachment; filename="plan.pdf"; filename*=UTF-8''${encoded}`,
        },
      }),
    );

    // When
    const { filename } = await requestBlob('/export/plan/7');

    // Then — the plain `filename` is the mangled fallback, not the one to prefer
    expect(filename).toBe('Πλάνο - Ελένη Παπαδοπούλου.pdf');
  });

  it('should fall back to the plain filename, when there is no encoded form', async () => {
    // Given
    vi.mocked(fetch).mockResolvedValue(
      new Response(new Blob(['%PDF-1.4']), {
        status: 200,
        headers: { 'Content-Disposition': 'attachment; filename="plan.pdf"' },
      }),
    );

    // When / Then
    expect((await requestBlob('/export/plan/7')).filename).toBe('plan.pdf');
  });

  it('should return a null filename rather than throwing, when the header is absent', async () => {
    // Given
    vi.mocked(fetch).mockResolvedValue(new Response(new Blob(['%PDF-1.4']), { status: 200 }));

    // When / Then — the caller can name the download itself; losing it is not worth failing over
    expect((await requestBlob('/export/plan/7')).filename).toBeNull();
  });
});
