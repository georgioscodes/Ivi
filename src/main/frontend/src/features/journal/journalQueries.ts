import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { request } from '@/api/http';
import type {
  JournalEntryCreateRequest,
  JournalEntryResponse,
  JournalEntryUpdateRequest,
  PagedResponse,
} from '@/api/types';

export const journalKeys = {
  all: ['journal'] as const,
  listForClient: (clientId: number, term: string, page: number) =>
    [...journalKeys.all, 'list', clientId, term, page] as const,
};

const journal = {
  forClient: (clientId: number, term: string, page: number) =>
    request<PagedResponse<JournalEntryResponse>>('/journal', {
      // An empty term is omitted rather than sent blank, so the server takes the unfiltered path
      // instead of running a search that matches everything.
      query: { clientId, page, ...(term ? { q: term } : {}) },
    }),

  create: (body: JournalEntryCreateRequest) =>
    request<JournalEntryResponse>('/journal', { method: 'POST', body }),

  update: (id: number, body: JournalEntryUpdateRequest) =>
    request<JournalEntryResponse>(`/journal/${id}`, { method: 'PUT', body }),

  remove: (id: number) => request<void>(`/journal/${id}`, { method: 'DELETE' }),
};

/**
 * A client's entries, newest first, optionally filtered.
 *
 * `placeholderData` keeps the previous page on screen while the next arrives, so paging and typing
 * do not blank the list out from under the practitioner.
 */
export function useJournalEntries(clientId: number, term: string, page: number) {
  return useQuery({
    queryKey: journalKeys.listForClient(clientId, term, page),
    queryFn: () => journal.forClient(clientId, term, page),
    placeholderData: (previous) => previous,
  });
}

export function useCreateJournalEntry(clientId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: JournalEntryCreateRequest) => journal.create(body),
    onSuccess: () => invalidateFor(queryClient, clientId),
  });
}

/**
 * Amends an entry.
 *
 * The whole entry is sent, not the changed field: `content` is `@NotBlank` server-side, so a
 * partial update would be rejected anyway, and an amend is one deliberate act rather than a
 * stream of edits.
 */
export function useUpdateJournalEntry(clientId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: JournalEntryUpdateRequest }) =>
      journal.update(id, body),
    onSuccess: () => invalidateFor(queryClient, clientId),
  });
}

export function useDeleteJournalEntry(clientId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => journal.remove(id),
    onSuccess: () => invalidateFor(queryClient, clientId),
  });
}

/**
 * Every cached page for this client is dropped after a write.
 *
 * Writing an entry can move it between pages — entries are ordered by date, and an amended date
 * reorders the list — so patching the page in hand would leave the others wrong. The promise is
 * **returned** so the mutation stays pending until the refreshed list has arrived: the form closes
 * onto the entry it just saved, not onto the list from before it.
 */
function invalidateFor(queryClient: ReturnType<typeof useQueryClient>, clientId: number) {
  return queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === 'journal' && query.queryKey.includes(clientId),
  });
}
