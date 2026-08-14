import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/ApiError';
import { request } from '@/api/http';
import type { PlanItemAddRequest, PlanItemUpdateRequest, PlanResponse } from '@/api/types';
import { planKeys } from './planQueries';

/**
 * Every plan mutation returns the whole plan, and every one of them writes that response straight
 * into the cache.
 *
 * Adding one food moves the item's meal total, the day's four totals, the day's four percentages
 * and the plan's daily average. Patching the changed item and deriving the rest would be the
 * second implementation of the server's arithmetic — the thing this design exists to prevent. So
 * the response replaces the plan wholesale and nothing is recomputed.
 *
 * `setQueryData` rather than `invalidateQueries`: the server has just sent the canonical state, so
 * fetching it again would be a round trip to learn what we already know.
 */
function useReplacePlan(planId: number) {
  const queryClient = useQueryClient();
  return (plan: PlanResponse) => queryClient.setQueryData(planKeys.detail(planId), plan);
}

/**
 * Runs a plan mutation, retrying once if the optimistic lock rejects it.
 *
 * `@Version` sits on the plan *aggregate*, and every item operation bumps it. Measured against
 * the running server: four simultaneous adds to four **different meals** produced three 409s and
 * lost three legitimate items. Nothing about those edits actually conflicted — they collided only
 * because they shared a version counter.
 *
 * A retry is safe here in a way it is not for a network failure. A 409 from optimistic locking
 * means the transaction rolled back, so the change definitively did not apply; re-sending it
 * cannot duplicate anything. A timed-out request carries no such guarantee, which is why the
 * global mutation retry stays off and this is scoped to 409 alone.
 *
 * The plan is re-fetched before the retry so the second attempt starts from current state.
 * If it conflicts again, that is a real fight over the same record and the caller surfaces it.
 */
function useConflictRetry(planId: number) {
  const queryClient = useQueryClient();

  return async function run(attempt: () => Promise<PlanResponse>): Promise<PlanResponse> {
    try {
      return await attempt();
    } catch (error) {
      if (!(error instanceof ApiError) || !error.isConflict) {
        throw error;
      }
      await queryClient.fetchQuery({
        queryKey: planKeys.detail(planId),
        queryFn: () => request<PlanResponse>(`/plan/${planId}`),
      });
      return attempt();
    }
  };
}

export function useAddItem(planId: number) {
  const replacePlan = useReplacePlan(planId);
  const withRetry = useConflictRetry(planId);

  return useMutation({
    mutationFn: ({ mealId, body }: { mealId: number; body: PlanItemAddRequest }) =>
      withRetry(() =>
        request<PlanResponse>(`/plan/${planId}/meal/${mealId}/item`, { method: 'POST', body }),
      ),
    onSuccess: replacePlan,
  });
}

/**
 * Changes an item's quantity, its printed name, or both.
 *
 * The request is a partial update and the server treats it as one: a null field is left alone,
 * so sending only a quantity cannot wipe a name the practitioner set earlier. An *empty* name is
 * different from an absent one — it clears the override and restores the catalogue name — which
 * is what makes "restore the original" expressible at all.
 */
export function useUpdateItem(planId: number) {
  const replacePlan = useReplacePlan(planId);
  const withRetry = useConflictRetry(planId);

  return useMutation({
    mutationFn: ({ itemId, body }: { itemId: number; body: PlanItemUpdateRequest }) =>
      withRetry(() =>
        request<PlanResponse>(`/plan/${planId}/item/${itemId}`, { method: 'PUT', body }),
      ),
    onSuccess: replacePlan,
  });
}

export function useRemoveItem(planId: number) {
  const replacePlan = useReplacePlan(planId);
  const withRetry = useConflictRetry(planId);

  return useMutation({
    mutationFn: (itemId: number) =>
      withRetry(() =>
        request<PlanResponse>(`/plan/${planId}/item/${itemId}`, { method: 'DELETE' }),
      ),
    onSuccess: replacePlan,
  });
}
