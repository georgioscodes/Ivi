import type { PageRequest } from './types';

/**
 * Query keys, in one place.
 *
 * Keys are hierarchical so a mutation can invalidate a whole resource without knowing which
 * filters and pages happen to be cached: invalidating `clientKeys.lists()` catches every search
 * term and every page of results.
 *
 * Scattering key literals across hooks is how a cache ends up with two spellings of the same
 * query, one of which never gets invalidated and quietly serves stale data. In an application
 * where the server is the only authority on every number, that is exactly the failure the
 * architecture is meant to prevent.
 */
export const sessionKeys = {
  current: ['session'] as const,
};

export const clientKeys = {
  all: ['client'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  list: (params: { name?: string } & PageRequest) => [...clientKeys.lists(), params] as const,
  details: () => [...clientKeys.all, 'detail'] as const,
  detail: (id: number) => [...clientKeys.details(), id] as const,
};
