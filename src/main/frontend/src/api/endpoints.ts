import { request } from './http';
import type {
  ClientCreateRequest,
  ClientResponse,
  ClientUpdateRequest,
  LoginRequest,
  PagedResponse,
  PageRequest,
  PractitionerRegisterRequest,
  PractitionerResponse,
} from './types';

/**
 * One function per endpoint. No React, no cache — just the call and its types, so the shape of
 * the API is readable in one place and testable without a component around it.
 */

export const auth = {
  login: (body: LoginRequest) =>
    request<PractitionerResponse>('/auth/login', { method: 'POST', body }),

  /** 204. Invalidates the session server-side; the cookie alone is not the session. */
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
};

export const practitioner = {
  register: (body: PractitionerRegisterRequest) =>
    request<PractitionerResponse>('/practitioner/registration', { method: 'POST', body }),

  /** The session bootstrap. A 401 here means not signed in, which is a normal first load. */
  me: () => request<PractitionerResponse>('/practitioner/me'),
};

export const clients = {
  list: (params: { name?: string } & PageRequest = {}) =>
    request<PagedResponse<ClientResponse>>('/client', {
      query: {
        name: params.name,
        page: params.page,
        size: params.size,
        sort: params.sort,
      },
    }),

  /** 404 for a client belonging to another practitioner — never 403, which would confirm it exists. */
  get: (id: number) => request<ClientResponse>(`/client/${id}`),

  create: (body: ClientCreateRequest) =>
    request<ClientResponse>('/client', { method: 'POST', body }),

  update: (id: number, body: ClientUpdateRequest) =>
    request<ClientResponse>(`/client/${id}`, { method: 'PUT', body }),

  remove: (id: number) => request<void>(`/client/${id}`, { method: 'DELETE' }),
};
