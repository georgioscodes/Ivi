import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { request } from '@/api/http';
import type {
  MeasurementBatchRequest,
  MeasurementRecordRequest,
  MeasurementResponse,
  MeasurementSeriesResponse,
  MeasurementSummaryResponse,
  MeasurementTypeResponse,
  PagedResponse,
  PageRequest,
} from '@/api/types';

export const measurementKeys = {
  all: ['measurement'] as const,
  types: () => [...measurementKeys.all, 'type'] as const,
  history: (clientId: number, page: number) =>
    [...measurementKeys.all, 'history', clientId, page] as const,
  summary: (clientId: number) => [...measurementKeys.all, 'summary', clientId] as const,
  series: (clientId: number, typeCode: string) =>
    [...measurementKeys.all, 'series', clientId, typeCode] as const,
};

const measurements = {
  types: () => request<MeasurementTypeResponse[]>('/measurement/type'),

  history: (clientId: number, page: PageRequest) =>
    request<PagedResponse<MeasurementResponse>>('/measurement', {
      query: { clientId, page: page.page, size: page.size },
    }),

  summary: (clientId: number) =>
    request<MeasurementSummaryResponse>('/measurement/summary', { query: { clientId } }),

  series: (clientId: number, typeCode: string) =>
    request<MeasurementSeriesResponse>('/measurement/series', { query: { clientId, typeCode } }),

  record: (body: MeasurementRecordRequest) =>
    request<MeasurementResponse>('/measurement', { method: 'POST', body }),

  recordBatch: (body: MeasurementBatchRequest) =>
    request<MeasurementResponse[]>('/measurement/batch', { method: 'POST', body }),

  remove: (id: number) => request<void>(`/measurement/${id}`, { method: 'DELETE' }),
};

/**
 * What can be measured. Reference data — identical for every practitioner and unchanged for the
 * life of a deployment — so it is fetched once and kept.
 */
export function useMeasurementTypes() {
  return useQuery({
    queryKey: measurementKeys.types(),
    queryFn: measurements.types,
    staleTime: Infinity,
  });
}

export function useMeasurementHistory(clientId: number, page: number, size = 50) {
  return useQuery({
    queryKey: measurementKeys.history(clientId, page),
    queryFn: () => measurements.history(clientId, { page, size }),
    placeholderData: (previous) => previous,
  });
}

export function useMeasurementSummary(clientId: number) {
  return useQuery({
    queryKey: measurementKeys.summary(clientId),
    queryFn: () => measurements.summary(clientId),
  });
}

export function useMeasurementSeries(clientId: number, typeCode: string | null) {
  return useQuery({
    queryKey: measurementKeys.series(clientId, typeCode ?? ''),
    queryFn: () => measurements.series(clientId, typeCode as string),
    enabled: typeCode !== null,
  });
}

/**
 * Everything taken at one visit, in one request.
 *
 * The reason this endpoint exists rather than a loop of single posts: a visit produces a dozen
 * readings, and a loop can half-succeed, leaving a session recorded with three of its twelve
 * values and no indication which are missing.
 */
export function useRecordVisit(clientId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: MeasurementBatchRequest) => measurements.recordBatch(body),
    onSuccess: () => invalidateFor(queryClient, clientId),
  });
}

export function useRecordMeasurement(clientId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: MeasurementRecordRequest) => measurements.record(body),
    onSuccess: () => invalidateFor(queryClient, clientId),
  });
}

export function useDeleteMeasurement(clientId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => measurements.remove(id),
    onSuccess: () => invalidateFor(queryClient, clientId),
  });
}

/**
 * One recorded value moves the history, the summary, the BMI and every series at once. Rather
 * than work out which, everything for this client is dropped — these are small queries and the
 * cost of being wrong is a stale number on screen, which is the failure this application is
 * built to avoid.
 *
 * The promise is **returned**, not discarded. A mutation whose `onSuccess` returns a promise
 * stays pending until it settles, so the entry form remains up until the refreshed figures have
 * actually arrived. Firing the invalidation and returning immediately closes the form over a
 * summary still showing the values from before the save — which is precisely the disagreement
 * between screen and server that making the server authoritative was meant to eliminate. It was
 * visible in testing: a BMI of 28,3 on screen for a client the server already had at 27,7.
 */
function invalidateFor(queryClient: ReturnType<typeof useQueryClient>, clientId: number) {
  return queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === 'measurement' && query.queryKey.includes(clientId),
  });
}
