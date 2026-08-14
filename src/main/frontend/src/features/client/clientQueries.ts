import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { clients } from '@/api/endpoints';
import { clientKeys } from '@/api/keys';
import type { ClientCreateRequest, ClientResponse, PageRequest } from '@/api/types';

export function useClients(params: { name?: string } & PageRequest) {
  return useQuery({
    queryKey: clientKeys.list(params),
    queryFn: () => clients.list(params),
    // Keeps the current page visible while the next one loads. Without it, typing in the search
    // box empties the table on every keystroke and the layout jumps.
    placeholderData: (previous) => previous,
  });
}

export function useClient(id: number) {
  return useQuery({
    queryKey: clientKeys.detail(id),
    queryFn: () => clients.get(id),
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: ClientCreateRequest) => clients.create(body),
    onSuccess: (created) => {
      // Seed the detail cache from the response, so navigating to the new client does not
      // re-fetch what the server just returned.
      queryClient.setQueryData(clientKeys.detail(created.id), created);
      // Every list — every search term, every page — is now potentially wrong.
      void queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    },
  });
}

export function useUpdateClient(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: ClientCreateRequest) => clients.update(id, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(clientKeys.detail(id), updated);
      void queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => clients.remove(id),
    onSuccess: (_result, id) => {
      // Removed rather than invalidated: the record is gone, and a refetch would 404. Leaving it
      // cached lets a stale route render a client that no longer exists.
      queryClient.removeQueries({ queryKey: clientKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    },
  });
}

/** Convenience for the list, which shows a dash rather than an empty cell. */
export function displayValue(value: string | null | undefined): string {
  return value?.trim() ? value : '—';
}

/**
 * Formats a date the way Greek practitioners write one. `Intl` rather than a hand-rolled
 * formatter so the ordering and separators come from the locale rather than from an assumption.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '—'
    : new Intl.DateTimeFormat('el-GR', { dateStyle: 'medium' }).format(parsed);
}

export type { ClientResponse };
