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

// --- Plans -------------------------------------------------------------------------------------

export type MealType =
  | 'BREAKFAST'
  | 'MORNING_SNACK'
  | 'LUNCH'
  | 'AFTERNOON_SNACK'
  | 'DINNER'
  | 'EVENING_SNACK';

export type PlanStatus = 'DRAFT' | 'ISSUED' | 'ARCHIVED';

export interface MacroTotals {
  energyKcal: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
}

/**
 * A line in a meal.
 *
 * Every figure is the server's, computed from a per-100g snapshot taken when the item was added.
 * `totalGrams` is `portionGrams × quantity`, and the four nutrient values follow from it — the
 * client multiplies nothing.
 */
export interface PlanItemResponse {
  id: number;
  /** Null once the food has been deleted. The item survives; the prescription still happened. */
  foodId: number | null;
  name: string;
  portionLabel: string | null;
  portionGrams: number;
  quantity: number;
  totalGrams: number;
  energyKcal: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
  sortOrder: number;
}

export interface PlanMealResponse {
  id: number;
  mealType: MealType | (string & {});
  timeLabel: string | null;
  sortOrder: number;
  items: PlanItemResponse[];
  totals: MacroTotals;
}

export interface PlanDayResponse {
  id: number;
  /** Zero-based. Day 0 is Monday when a plan is a literal week. */
  dayIndex: number;
  /** The practitioner's own label, or null. Not a resolved heading — see `dayLabel`. */
  label: string | null;
  meals: PlanMealResponse[];
  totals: MacroTotals;
  /** Percent of the plan's target, per macro. Server-computed; never derived here. */
  targetPercent: MacroTotals;
}

export interface PlanResponse {
  id: number;
  clientId: number;
  name: string;
  status: PlanStatus | (string & {});
  targets: MacroTotals;
  basis: string | null;
  activityFactor: number | null;
  notes: string | null;
  days: PlanDayResponse[];
  dailyAverage: MacroTotals;
  /** Optimistic lock. A stale value is what turns a concurrent edit into a 409 rather than a
   *  silent overwrite. */
  version: number;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
}

export interface PlanSummaryResponse {
  id: number;
  clientId: number;
  name: string;
  status: PlanStatus | (string & {});
  targetKcal: number;
  dayCount: number;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
}

export interface PlanCreateRequest {
  clientId: number;
  name: string;
  targetKcal: number;
  targetProteinG: number;
  targetCarbohydrateG: number;
  targetFatG: number;
  basis?: string;
  activityFactor?: number;
  dayCount: number;
}

export interface PlanItemAddRequest {
  foodId: number;
  portionId?: number;
  quantity: number;
}

export interface PlanItemUpdateRequest {
  quantity?: number;
  nameOverride?: string;
}

// --- Food catalogue ----------------------------------------------------------------------------

export type FoodCategory = 'FRESH' | 'CARBOHYDRATE' | 'PROTEIN' | 'FAT' | 'COMPOSITE';

export interface FoodPortionResponse {
  id: number;
  label: string;
  grams: number;
  isDefault: boolean;
}

export interface FoodPortionRequest {
  label: string;
  grams: number;
  isDefault: boolean;
}

/**
 * A food as this practitioner sees it. Composition is always per 100 g.
 *
 * The last three fields are the override machinery, and they are not interchangeable:
 *
 * - `global` — a shared catalogue food, which no practitioner can edit or delete.
 * - `overridden` — this row *is* a practitioner's private replacement for a catalogue food.
 *   Browsing returns the replacement, never both.
 * - `overridesFoodId` — the catalogue food being replaced.
 *
 * `id` is always this row's own id, so an override's id is the override's, not the catalogue
 * food's. Both work for reverting; only this one works for editing.
 */
export interface FoodResponse {
  id: number;
  nameEl: string;
  nameEn: string | null;
  category: FoodCategory | (string & {});
  energyKcal: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
  source: string;
  portions: FoodPortionResponse[];
  global: boolean;
  overridden: boolean;
  overridesFoodId: number | null;
}

export interface FoodCreateRequest {
  nameEl: string;
  nameEn?: string;
  category: string;
  energyKcal: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
  portions?: FoodPortionRequest[];
}

export type FoodUpdateRequest = FoodCreateRequest;

/** Every field optional: a suggestion may propose one correction and leave the rest alone. */
export interface FoodSuggestionRequest {
  proposedNameEl?: string;
  proposedEnergyKcal?: number;
  proposedProteinG?: number;
  proposedCarbohydrateG?: number;
  proposedFatG?: number;
  rationale?: string;
}

export interface FoodSuggestionResponse {
  id: number;
  foodId: number;
  proposedNameEl: string | null;
  proposedEnergyKcal: number | null;
  proposedProteinG: number | null;
  proposedCarbohydrateG: number | null;
  proposedFatG: number | null;
  rationale: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | (string & {});
  createdAt: IsoInstant;
  reviewedAt: IsoInstant | null;
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
