/**
 * TypeScript mirrors of the server's DTOs.
 *
 * These are hand-written against the Java records, which means they can drift. That is a real
 * risk and it is accepted for now rather than ignored: generating them needs an OpenAPI document,
 * and producing one needs the application booted against a database, which would make the
 * frontend build depend on Postgres. See docs/ui-build-tasks.md.
 *
 * Two conventions worth knowing:
 *
 * - `LocalDate` arrives as `YYYY-MM-DD` and `Instant` as ISO-8601 with an offset. Both are typed
 *   as branded strings below so a date is not silently passed where a timestamp belongs.
 * - Nulls are meaningful. The server serialises them rather than omitting keys, because several
 *   fields use null as a value: `outOfRange` is null when a measurement type defines no reference
 *   range, and that is different from a range the value sits inside.
 */

/** `YYYY-MM-DD`, no time and no zone. A birth date, a measurement date. */
export type IsoDate = string & { readonly __brand: 'IsoDate' };

/** ISO-8601 instant, e.g. `2026-08-13T18:36:44.453Z`. */
export type IsoInstant = string & { readonly __brand: 'IsoInstant' };

/** Mirrors {@code com.ivi.app.shared.dto.PagedResponse}. */
export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

/** Query parameters every paginated endpoint accepts. */
export interface PageRequest {
  page?: number;
  size?: number;
  /** Spring's format: `property,asc` or `property,desc`. */
  sort?: string;
}

/**
 * Mirrors {@code com.ivi.app.shared.exception.ErrorResponse}.
 *
 * `errors` is field name to message, populated by bean validation. It is always present, and
 * empty for failures that are not about a particular field.
 */
export interface ErrorResponse {
  status: number;
  message: string;
  timestamp: string;
  errors: Record<string, string>;
}

// --- Practitioner and session ----------------------------------------------------------------

export interface PractitionerResponse {
  id: number;
  email: string;
  displayName: string;
  practiceName: string | null;
  createdAt: IsoInstant;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface PractitionerRegisterRequest {
  email: string;
  /** Minimum 12 characters, enforced server-side. */
  password: string;
  displayName: string;
  practiceName?: string;
}

// --- Clients ---------------------------------------------------------------------------------

export interface ClientResponse {
  id: number;
  fullName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: IsoDate | null;
  goal: string | null;
  notes: string | null;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
}

export interface ClientCreateRequest {
  fullName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: IsoDate;
  goal?: string;
  notes?: string;
}

export type ClientUpdateRequest = ClientCreateRequest;
