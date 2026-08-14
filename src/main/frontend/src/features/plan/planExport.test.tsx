import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { createQueryClient } from '@/api/queryClient';
import { useExportPlan } from './planExport';

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>;
}

function pdf(disposition?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/pdf' };
  if (disposition) {
    headers['Content-Disposition'] = disposition;
  }
  return new Response(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), { status: 200, headers });
}

/**
 * The download itself: what the file ends up called, and whether it happens at all.
 *
 * The name matters more than it sounds. The server sends it percent-encoded in the RFC 5987
 * `filename*` form because it is Greek, and every hop between the header and the downloads folder
 * is a place it can turn into `ΞΞ±ΟΞ―Ξ±`.
 */
describe('useExportPlan', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let clicked: HTMLAnchorElement[];
  let createObjectURL: typeof URL.createObjectURL;
  let revokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(pdf());
    vi.stubGlobal('fetch', fetchMock);

    // The two object-URL methods are replaced on the real `URL`, not swapped for a stand-in
    // object: `URL` is also a constructor and the API layer builds every request path with it.
    createObjectURL = URL.createObjectURL;
    revokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:ivi/1');
    URL.revokeObjectURL = vi.fn();

    // happy-dom has no downloads folder, so the anchor's click is what stands in for the save.
    clicked = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
    });
  });

  afterEach(() => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should save under the Greek name the server sent', async () => {
    // Given — the header form Spring produces for a non-ASCII filename
    fetchMock.mockResolvedValue(
      pdf(
        "attachment; filename*=UTF-8''%CE%9C%CE%B1%CF%81%CE%AF%CE%B1%20-%20%CE%A0%CE%BB%CE%AC%CE%BD%CE%BF.pdf",
      ),
    );
    const { result } = renderHook(() => useExportPlan(42), { wrapper });

    result.current.mutate('εφεδρικό');

    await waitFor(() => expect(clicked).toHaveLength(1));
    expect(clicked[0]?.download).toBe('Μαρία - Πλάνο.pdf');
  });

  it('should fall back to the name the caller supplied when the header carries none', async () => {
    // Given — a proxy that strips the header. The file still has to be findable afterwards.
    const { result } = renderHook(() => useExportPlan(42), { wrapper });

    result.current.mutate('Μαρία - Πλάνο');

    await waitFor(() => expect(clicked).toHaveLength(1));
    expect(clicked[0]?.download).toBe('Μαρία - Πλάνο.pdf');
  });

  it('should ask the export endpoint for the plan', async () => {
    const { result } = renderHook(() => useExportPlan(42), { wrapper });

    result.current.mutate('πλάνο');

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/export/plan/42');
  });

  it('should surface a failure rather than saving an error page as a PDF', async () => {
    // Given — the export renders server-side and can fail there. Without this the browser would
    // write the JSON error body into the downloads folder with a .pdf extension.
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 500, message: 'boom', errors: {} }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const { result } = renderHook(() => useExportPlan(42), { wrapper });

    result.current.mutate('πλάνο');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(clicked).toHaveLength(0);
  });

  it('should not run on its own', () => {
    // Given — the server records every export in the audit log as data leaving the system. A
    // query would fire this on mount and on every cache miss; a mutation only fires when asked.
    renderHook(() => useExportPlan(42), { wrapper });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
