import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/ApiError';
import { request } from '@/api/http';
import type {
  PlanItemAddRequest,
  PlanItemUpdateRequest,
  PlanResponse,
  PlanStatus,
} from '@/api/types';
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

/**
 * Reorders the items in one meal.
 *
 * **This is the one plan mutation that updates optimistically**, and the reason is worth being
 * precise about: a position is not a nutrient value. Reordering changes no total, no percentage
 * and no average, so showing the new order before the server confirms it cannot put a number on
 * screen the server would contradict — which is the whole basis of the no-optimistic-UI rule.
 * Drag-and-drop that waits for a round trip before the row moves feels broken, so here the trade
 * is worth making.
 *
 * The optimistic state is rolled back if the request fails. The server's answer still wins:
 * whatever it returns replaces the cache, snapping the list to the truth if they differ.
 *
 * The endpoint wants the meal's *complete* item list and rejects anything else with a 400 —
 * which is a real possibility if the plan on screen is stale, so that failure is surfaced rather
 * than retried.
 */
export function useReorderItems(planId: number) {
  const queryClient = useQueryClient();
  const replacePlan = useReplacePlan(planId);
  const withRetry = useConflictRetry(planId);

  return useMutation({
    mutationFn: ({ mealId, orderedItemIds }: { mealId: number; orderedItemIds: number[] }) =>
      withRetry(() =>
        request<PlanResponse>(`/plan/${planId}/meal/${mealId}/order`, {
          method: 'PUT',
          body: orderedItemIds,
        }),
      ),

    onMutate: async ({ mealId, orderedItemIds }) => {
      // Stop an in-flight read from landing on top of the optimistic order.
      await queryClient.cancelQueries({ queryKey: planKeys.detail(planId) });
      const previous = queryClient.getQueryData<PlanResponse>(planKeys.detail(planId));

      if (previous) {
        queryClient.setQueryData(planKeys.detail(planId), reorderLocally(previous, mealId, orderedItemIds));
      }
      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(planKeys.detail(planId), context.previous);
      }
    },

    onSuccess: replacePlan,
  });
}

/** Applies the new order to a cached plan, leaving every figure exactly as the server sent it. */
function reorderLocally(
  plan: PlanResponse,
  mealId: number,
  orderedItemIds: number[],
): PlanResponse {
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      meals: day.meals.map((meal) => {
        if (meal.id !== mealId) {
          return meal;
        }
        const byId = new Map(meal.items.map((item) => [item.id, item]));
        const reordered = orderedItemIds
          .map((id) => byId.get(id))
          .filter((item): item is (typeof meal.items)[number] => item !== undefined);
        // Anything the id list did not mention keeps its place at the end rather than vanishing.
        const missing = meal.items.filter((item) => !orderedItemIds.includes(item.id));
        return { ...meal, items: [...reordered, ...missing] };
      }),
    })),
  };
}

/**
 * Empties a day, keeping its meal structure so it can be rebuilt.
 *
 * Not a delete of the day itself — the plan is still N days long afterwards, with N sets of empty
 * meals waiting.
 */
export function useClearDay(planId: number) {
  const replacePlan = useReplacePlan(planId);
  const withRetry = useConflictRetry(planId);

  return useMutation({
    mutationFn: (dayIndex: number) =>
      withRetry(() =>
        request<PlanResponse>(`/plan/${planId}/day/${dayIndex}/item`, { method: 'DELETE' }),
      ),
    onSuccess: replacePlan,
  });
}

/**
 * Moves the plan between draft, issued and archived.
 *
 * The server accepts any transition in any direction — these are labels on a document rather than
 * a workflow with gates. The UI offers the step that follows naturally from where the plan is,
 * which guides without inventing a constraint the server does not have.
 */
export function useUpdateStatus(planId: number) {
  const replacePlan = useReplacePlan(planId);
  const withRetry = useConflictRetry(planId);

  return useMutation({
    mutationFn: (status: PlanStatus) =>
      withRetry(() =>
        request<PlanResponse>(`/plan/${planId}/status`, { method: 'PATCH', body: { status } }),
      ),
    onSuccess: replacePlan,
  });
}

/**
 * Replaces the plan's notes — the instructions that print under the food in the client's PDF.
 *
 * Blank clears them, which removes the section from the export rather than printing an empty
 * heading. The server does that trimming; sending `''` and sending `null` mean the same thing.
 */
export function useUpdateNotes(planId: number) {
  const replacePlan = useReplacePlan(planId);
  const withRetry = useConflictRetry(planId);

  return useMutation({
    mutationFn: (notes: string) =>
      withRetry(() =>
        request<PlanResponse>(`/plan/${planId}/notes`, { method: 'PATCH', body: { notes } }),
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
