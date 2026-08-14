import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { request } from '@/api/http';
import type {
  FoodCreateRequest,
  FoodResponse,
  FoodSuggestionRequest,
  FoodSuggestionResponse,
  FoodUpdateRequest,
  PagedResponse,
  PageRequest,
} from '@/api/types';

export const foodKeys = {
  all: ['food'] as const,
  lists: () => [...foodKeys.all, 'list'] as const,
  list: (params: { q?: string; category?: string } & PageRequest) =>
    [...foodKeys.lists(), params] as const,
  detail: (id: number) => [...foodKeys.all, 'detail', id] as const,
  suggestions: (page: number) => [...foodKeys.all, 'suggestion', page] as const,
};

const foods = {
  browse: (params: { q?: string; category?: string } & PageRequest) =>
    request<PagedResponse<FoodResponse>>('/food', {
      query: { q: params.q, category: params.category, page: params.page, size: params.size },
    }),

  get: (id: number) => request<FoodResponse>(`/food/${id}`),

  create: (body: FoodCreateRequest) =>
    request<FoodResponse>('/food', { method: 'POST', body }),

  update: (id: number, body: FoodUpdateRequest) =>
    request<FoodResponse>(`/food/${id}`, { method: 'PUT', body }),

  revertOverride: (id: number) =>
    request<void>(`/food/${id}/override`, { method: 'DELETE' }),

  remove: (id: number) => request<void>(`/food/${id}`, { method: 'DELETE' }),

  suggest: (id: number, body: FoodSuggestionRequest) =>
    request<FoodSuggestionResponse>(`/food/${id}/suggestion`, { method: 'POST', body }),

  mySuggestions: (page: number) =>
    request<PagedResponse<FoodSuggestionResponse>>('/food/suggestion', { query: { page } }),
};

export function useFoods(params: { q?: string; category?: string } & PageRequest) {
  return useQuery({
    queryKey: foodKeys.list(params),
    queryFn: () => foods.browse(params),
    placeholderData: (previous) => previous,
  });
}

export function useFood(id: number) {
  return useQuery({
    queryKey: foodKeys.detail(id),
    queryFn: () => foods.get(id),
  });
}

export function useCreateFood() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: FoodCreateRequest) => foods.create(body),
    onSuccess: (created) => {
      queryClient.setQueryData(foodKeys.detail(created.id), created);
      return queryClient.invalidateQueries({ queryKey: foodKeys.lists() });
    },
  });
}

/**
 * Edits an owned food, or creates a private override of a catalogue one — the server decides
 * which from the id, and the response says what happened.
 *
 * Everything under `food` is invalidated rather than just the edited row. Overriding a catalogue
 * food changes which row the list returns for it, not merely that row's contents, so patching
 * the cache by id would leave the original still listed alongside its own replacement.
 */
export function useUpdateFood() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: FoodUpdateRequest }) => foods.update(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: foodKeys.all }),
  });
}

/** Drops the practitioner's private values so the catalogue default applies again. */
export function useRevertOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => foods.revertOverride(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: foodKeys.all }),
  });
}

export function useDeleteFood() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => foods.remove(id),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: foodKeys.detail(id) });
      return queryClient.invalidateQueries({ queryKey: foodKeys.lists() });
    },
  });
}

export function useSuggestChange(foodId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: FoodSuggestionRequest) => foods.suggest(foodId, body),
    // A suggestion changes nothing about the food itself — it is a proposal for review — so only
    // the suggestions list is stale.
    onSuccess: () =>
      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === 'food' && query.queryKey[1] === 'suggestion',
      }),
  });
}

/**
 * Names for the foods a page of suggestions refers to.
 *
 * `FoodSuggestionResponse` carries only `foodId` — the entity holds a soft reference with no
 * relation, so the server cannot resolve a name without a lookup of its own. Without this the
 * list reads "#26", which tells a practitioner reviewing their own proposals nothing.
 *
 * Resolved client-side, deduplicated by id, and cached under the same key the detail page uses,
 * so opening a food afterwards costs nothing. Bounded by the page size, and a failed lookup
 * simply leaves the id showing rather than failing the page.
 */
export function useFoodNames(ids: number[]) {
  const unique = [...new Set(ids)];

  const results = useQueries({
    queries: unique.map((id) => ({
      queryKey: foodKeys.detail(id),
      queryFn: () => foods.get(id),
      staleTime: 5 * 60 * 1000,
      retry: false,
    })),
  });

  const names = new Map<number, string>();
  unique.forEach((id, index) => {
    const name = results[index]?.data?.nameEl;
    if (name) {
      names.set(id, name);
    }
  });
  return names;
}

export function useMySuggestions(page: number) {
  return useQuery({
    queryKey: foodKeys.suggestions(page),
    queryFn: () => foods.mySuggestions(page),
    placeholderData: (previous) => previous,
  });
}
