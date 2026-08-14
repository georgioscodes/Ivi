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

// --- Measurements ------------------------------------------------------------------------------

/**
 * `BigDecimal` on the server. Jackson serialises it as a JSON number, and JavaScript numbers
 * cannot represent every decimal exactly — but these are body measurements to one or two places,
 * far inside the range where a double is exact enough to display. Nothing here is arithmetic:
 * every derived value, including BMI and every delta, is computed server-side and read as given.
 */
export interface MeasurementTypeResponse {
  code: string;
  labelEl: string;
  labelEn: string;
  unit: string;
  category: 'ANTHROPOMETRIC' | 'BODY_COMPOSITION' | 'CIRCUMFERENCE' | (string & {});
  /** Null when the type defines no reference range — which is every seeded type today. */
  referenceMin: number | null;
  referenceMax: number | null;
  /** How many places to show. Not a hint: it is the type's precision. */
  decimals: number;
}

export interface MeasurementResponse {
  id: number;
  clientId: number;
  typeCode: string;
  label: string;
  unit: string;
  value: number;
  recordedOn: IsoDate;
  notes: string | null;
  /** Null when the type has no reference range — meaningfully different from "in range". */
  outOfRange: boolean | null;
}

export interface MeasurementRecordRequest {
  clientId: number;
  typeCode: string;
  value: number;
  recordedOn?: IsoDate;
  notes?: string;
}

export interface MeasurementBatchRequest {
  clientId: number;
  recordedOn?: IsoDate;
  values: { typeCode: string; value: number }[];
}

export interface MeasurementSeriesPoint {
  recordedOn: IsoDate;
  value: number;
  /** Server-computed. The client plots these; it does not subtract anything. */
  changeFromPrevious: number | null;
  changeFromFirst: number | null;
}

export interface MeasurementSeriesResponse {
  typeCode: string;
  label: string;
  unit: string;
  points: MeasurementSeriesPoint[];
  firstValue: number | null;
  latestValue: number | null;
  totalChange: number | null;
}

// --- Nutrition targets -------------------------------------------------------------------------

export type BmrEquation =
  | 'HARRIS_BENEDICT_ORIGINAL'
  | 'HARRIS_BENEDICT_REVISED'
  | 'MIFFLIN_ST_JEOR';

export type Sex = 'MALE' | 'FEMALE';

export interface ActivityLevelResponse {
  code: string;
  factor: number;
  labelEl: string;
  labelEn: string;
}

export interface BmrRequest {
  equation: BmrEquation;
  sex: Sex;
  weightKg: number;
  heightCm: number;
  ageYears: number;
}

/**
 * Exactly one of `bmr`, `manualBmrKcal` and `manualEnergyKcal`. The server rejects zero or more
 * than one, which is the right place for that rule to live — the UI's job is to make choosing
 * one of the three obvious enough that it never has to.
 */
export interface EnergyRequirementRequest {
  bmr?: BmrRequest;
  manualBmrKcal?: number;
  manualEnergyKcal?: number;
  activityFactor?: number;
  /** Negative for loss, positive for gain. The sign is the whole meaning. */
  targetWeightChangeKg?: number;
  periodDays?: number;
}

export interface EnergyRequirementResponse {
  bmrKcal: number | null;
  /** An equation name, or `MANUAL`, or `DIRECT`. A code, not display text. */
  basis: string;
  activityFactor: number | null;
  maintenanceKcal: number;
  weightGoalAdjustmentKcal: number;
  targetKcal: number;
}

export interface MacroDistributionRequest {
  targetKcal: number;
  carbohydratePercent: number;
  proteinPercent: number;
  fatPercent: number;
}

export interface CoefficientRequirementRequest {
  weightKg: number;
  carbohydrateGPerKg: number;
  proteinGPerKg: number;
  fatGPerKg: number;
}

export interface MacroDistributionResponse {
  targetKcal: number;
  carbohydrateG: number;
  proteinG: number;
  fatG: number;
  carbohydrateKcal: number;
  proteinKcal: number;
  fatKcal: number;
}

export interface MeasurementSummaryResponse {
  clientId: number;
  latest: MeasurementResponse[];
  /** Null unless both weight and height are known. Never computed here to fill the gap. */
  bmi: number | null;
  bmiCategory: string | null;
}
