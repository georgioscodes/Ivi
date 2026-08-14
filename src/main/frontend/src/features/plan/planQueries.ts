import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { request } from '@/api/http';
import type {
  PagedResponse,
  PlanCreateRequest,
  PlanResponse,
  PlanSummaryResponse,
} from '@/api/types';

export const planKeys = {
  all: ['plan'] as const,
  lists: () => [...planKeys.all, 'list'] as const,
  listForClient: (clientId: number, page: number) =>
    [...planKeys.lists(), clientId, page] as const,
  detail: (id: number) => [...planKeys.all, 'detail', id] as const,
};

export const plans = {
  get: (id: number) => request<PlanResponse>(`/plan/${id}`),

  forClient: (clientId: number, page: number) =>
    request<PagedResponse<PlanSummaryResponse>>('/plan', { query: { clientId, page } }),

  create: (body: PlanCreateRequest) =>
    request<PlanResponse>('/plan', { method: 'POST', body }),

  remove: (id: number) => request<void>(`/plan/${id}`, { method: 'DELETE' }),
};

export function usePlan(id: number) {
  return useQuery({
    queryKey: planKeys.detail(id),
    queryFn: () => plans.get(id),
  });
}

export function usePlansForClient(clientId: number, page: number) {
  return useQuery({
    queryKey: planKeys.listForClient(clientId, page),
    queryFn: () => plans.forClient(clientId, page),
    placeholderData: (previous) => previous,
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: PlanCreateRequest) => plans.create(body),
    onSuccess: (created) => {
      // The response is the whole plan, so opening it needs no further request.
      queryClient.setQueryData(planKeys.detail(created.id), created);
      return queryClient.invalidateQueries({ queryKey: planKeys.lists() });
    },
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => plans.remove(id),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: planKeys.detail(id) });
      return queryClient.invalidateQueries({ queryKey: planKeys.lists() });
    },
  });
}
