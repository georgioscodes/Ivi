import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { createQueryClient } from '@/api/queryClient';
import { useAddItem, useUpdateItem } from './planMutations';

const PLAN = {
  id: 1,
  clientId: 1,
  name: 'Πλάνο',
  status: 'DRAFT',
  targets: { energyKcal: 2000, proteinG: 120, carbohydrateG: 250, fatG: 67 },
  basis: null,
  activityFactor: null,
  notes: null,
  days: [],
  dailyAverage: { energyKcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0 },
  version: 3,
  createdAt: '2026-08-14T00:00:00Z',
  updatedAt: '2026-08-14T00:00:00Z',
};

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const CONFLICT = { status: 409, message: 'changed elsewhere', errors: {} };

describe('plan mutations and the optimistic lock', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    document.cookie = 'XSRF-TOKEN=token; path=/';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should retry once when the lock rejects a change, because nothing was applied', async () => {
    // Given — `@Version` sits on the plan aggregate, so two edits sharing nothing in common
    // still collide. Measured against the real server: four simultaneous adds to four different
    // meals produced three 409s and lost three items.
    //
    // A 409 from optimistic locking means the transaction rolled back, so re-sending cannot
    // duplicate anything — which is exactly what makes this retry safe.
    fetchMock
      .mockResolvedValueOnce(json(CONFLICT, 409)) // the add
      .mockResolvedValueOnce(json(PLAN)) // the re-fetch before retrying
      .mockResolvedValueOnce(json(PLAN)); // the retry

    const { result } = renderHook(() => useAddItem(1), { wrapper });

    // When
    result.current.mutate({ mealId: 2, body: { foodId: 3, quantity: 1 } });

    // Then
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('should re-read the plan before retrying, so the second attempt is not also stale', async () => {
    // Given
    fetchMock
      .mockResolvedValueOnce(json(CONFLICT, 409))
      .mockResolvedValueOnce(json(PLAN))
      .mockResolvedValueOnce(json(PLAN));

    const { result } = renderHook(() => useUpdateItem(1), { wrapper });

    // When
    result.current.mutate({ itemId: 9, body: { quantity: 2 } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Then — the middle call is a plain read of the plan
    const [, second] = fetchMock.mock.calls;
    expect(String(second?.[0])).toBe('/api/v1/plan/1');
    expect((second?.[1] as RequestInit)?.method ?? 'GET').toBe('GET');
  });

  it('should give up after one retry, so a real fight surfaces instead of looping', async () => {
    // Given — two people genuinely editing the same record. Retrying forever would spin.
    fetchMock
      .mockResolvedValueOnce(json(CONFLICT, 409))
      .mockResolvedValueOnce(json(PLAN))
      .mockResolvedValueOnce(json(CONFLICT, 409));

    const { result } = renderHook(() => useAddItem(1), { wrapper });

    // When
    result.current.mutate({ mealId: 2, body: { foodId: 3, quantity: 1 } });

    // Then
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('should not retry a server fault, which may already have been applied', async () => {
    // Given — a 500 or a timeout carries no guarantee the write did not land, and re-sending an
    // add would put the food in the plan twice. Only the lock's explicit rollback is retried.
    fetchMock.mockResolvedValue(json({ status: 500, message: 'boom', errors: {} }, 500));

    const { result } = renderHook(() => useAddItem(1), { wrapper });

    // When
    result.current.mutate({ mealId: 2, body: { foodId: 3, quantity: 1 } });

    // Then
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should write the returned plan into the cache rather than re-fetching it', async () => {
    // Given — the response is the canonical plan, so asking for it again is a round trip to
    // learn what we already hold
    fetchMock.mockResolvedValueOnce(json({ ...PLAN, version: 4 }));

    const { result } = renderHook(() => useAddItem(1), { wrapper });

    // When
    result.current.mutate({ mealId: 2, body: { foodId: 3, quantity: 1 } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Then — exactly one request: the mutation itself
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.data?.version).toBe(4);
  });
});
