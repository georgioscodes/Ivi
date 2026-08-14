import { useEffect, useRef, useState } from 'react';

import { messageFor } from '@/api/messages';
import type { FoodResponse } from '@/api/types';
import { Empty, ErrorState, Skeleton } from '@/components/states';
import { useDebounced } from '@/components/useDebounced';
import { FOOD_CATEGORIES, badgeFor, categoryLabel } from '@/features/food/foodLabels';
import { useFoods } from '@/features/food/foodQueries';
import { formatGrams, formatKcal, formatQuantity } from './planLabels';
import { strings } from '@/strings';
import './plan.css';

interface AddFoodDialogProps {
  open: boolean;
  /** Named so the practitioner can see which meal they are filling without closing the dialog. */
  mealLabel: string;
  dayLabel: string;
  busy: boolean;
  error: unknown;
  onAdd: (body: { foodId: number; portionId?: number; quantity: number }) => void;
  onClose: () => void;
}

/**
 * Search the catalogue, pick a portion, choose a quantity, add.
 *
 * Two steps rather than one list of everything: choosing *which* food and choosing *how much* are
 * different decisions, and squeezing a portion picker into every result row makes a list of twenty
 * unreadable. Picking a food swaps the panel; going back is one click.
 */
export function AddFoodDialog({
  open,
  mealLabel,
  dayLabel,
  busy,
  error,
  onAdd,
  onClose,
}: AddFoodDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [typed, setTyped] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<FoodResponse | null>(null);

  const q = useDebounced(typed);
  const results = useFoods({
    q: q || undefined,
    category: category || undefined,
    page: 0,
    size: 20,
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
      searchRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // A fresh dialog every time it opens. Reopening on the previous search, three meals later, is
  // the kind of thing that quietly puts the wrong food in the wrong place.
  useEffect(() => {
    if (open) {
      setTyped('');
      setCategory('');
      setSelected(null);
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="dialog add-food"
      aria-labelledby="add-food-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) {
          onClose();
        }
      }}
    >
      <h2 className="dialog__title" id="add-food-title">
        Προσθήκη τροφίμου
        <span className="add-food__target">
          {dayLabel} · {mealLabel}
        </span>
      </h2>

      {error ? (
        <p className="form-error" role="alert">
          {messageFor(error)}
        </p>
      ) : null}

      {selected ? (
        <PortionStep
          food={selected}
          busy={busy}
          onBack={() => setSelected(null)}
          onAdd={onAdd}
          onClose={onClose}
        />
      ) : (
        <>
          <div className="add-food__filters">
            <div className="add-food__search">
              <label className="visually-hidden" htmlFor="add-food-search">
                {strings.common.search}
              </label>
              <input
                ref={searchRef}
                id="add-food-search"
                type="search"
                className="field__input"
                placeholder="Αναζήτηση τροφίμου…"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
              />
            </div>
            <select
              className="field__input add-food__category"
              aria-label="Κατηγορία"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">Όλες οι κατηγορίες</option>
              {FOOD_CATEGORIES.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="add-food__results">
            {results.isPending ? <Skeleton rows={5} /> : null}
            {results.error ? (
              <ErrorState error={results.error} onRetry={() => void results.refetch()} />
            ) : null}
            {results.data && results.data.content.length === 0 ? (
              <Empty title={strings.empty.noResults} hint={strings.empty.noResultsHint} />
            ) : null}

            {results.data?.content.map((food) => {
              const badge = badgeFor(food);
              return (
                <button
                  type="button"
                  className="food-result"
                  key={food.id}
                  onClick={() => setSelected(food)}
                >
                  <span className="food-result__name">
                    {food.nameEl}
                    {/*
                      An overridden food carries this practitioner's own values. They are about
                      to become a line in a plan, so the marking has to survive into this list.
                    */}
                    {badge ? (
                      <span className={`food-badge food-badge--${badge.kind}`}>{badge.label}</span>
                    ) : null}
                  </span>
                  <span className="food-result__meta">{categoryLabel(food.category)}</span>
                  {/* Per 100 g, stated — the same figures the catalogue shows. */}
                  <span className="food-result__composition">
                    {formatKcal(food.energyKcal)} kcal · Π {formatGrams(food.proteinG)} · Υ{' '}
                    {formatGrams(food.carbohydrateG)} · Λ {formatGrams(food.fatG)}
                    <span className="food-result__per"> / 100 g</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="dialog__actions">
            <button type="button" className="button button--secondary" onClick={onClose}>
              {strings.common.close}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}

interface PortionStepProps {
  food: FoodResponse;
  busy: boolean;
  onBack: () => void;
  onAdd: (body: { foodId: number; portionId?: number; quantity: number }) => void;
  onClose: () => void;
}

function PortionStep({ food, busy, onBack, onAdd }: PortionStepProps) {
  /**
   * The food's own default, which is the unit it was defined with.
   *
   * There is deliberately **no "grams" option**. Omitting `portionId` does not mean grams to this
   * API — `PlanService.choosePortion` falls back to the food's default portion — so a "grams"
   * choice that sent no portion id would silently turn "150 grams" into "150 × φέτα", which is a
   * wrong prescription arrived at without a single error.
   *
   * A food with no portions at all is the one case where quantity *is* a multiple of weight: the
   * server synthesises a 100 g unit, and the field below says so.
   */
  const defaultPortion = food.portions.find((portion) => portion.isDefault) ?? food.portions[0];
  const weightOnly = food.portions.length === 0;

  const [portionId, setPortionId] = useState<number | null>(defaultPortion?.id ?? null);
  const [quantity, setQuantity] = useState('1');

  const portion = food.portions.find((candidate) => candidate.id === portionId);
  const parsed = Number(quantity);
  const valid = quantity.trim() !== '' && Number.isFinite(parsed) && parsed > 0;

  return (
    <div className="portion-step">
      <button type="button" className="button button--link portion-step__back" onClick={onBack}>
        ← Άλλο τρόφιμο
      </button>

      <h3 className="portion-step__name">{food.nameEl}</h3>
      <p className="portion-step__composition">
        {formatKcal(food.energyKcal)} kcal · Π {formatGrams(food.proteinG)} g · Υ{' '}
        {formatGrams(food.carbohydrateG)} g · Λ {formatGrams(food.fatG)} g / 100 g
      </p>

      <div className="portion-step__row">
        {weightOnly ? (
          <p className="portion-step__unit-note">
            Το τρόφιμο δεν έχει μερίδες. Η ποσότητα μετριέται σε μονάδες των 100 g.
          </p>
        ) : (
          <div className="field">
            <label className="field__label" htmlFor="add-portion">
              Μερίδα
            </label>
            <select
              id="add-portion"
              className="field__input"
              value={portionId ?? ''}
              onChange={(event) => setPortionId(Number(event.target.value))}
            >
              {food.portions.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.label} ({formatGrams(candidate.grams)} g)
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="field">
          <label className="field__label" htmlFor="add-quantity">
            {weightOnly ? 'Ποσότητα (× 100 g)' : 'Ποσότητα'}
          </label>
          <input
            id="add-quantity"
            className="field__input"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.25"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </div>
      </div>

      {/*
        What the plan will record, stated but not costed. The gram weight is the practitioner's
        own multiplication of two numbers they just chose, so showing it is honest; the energy and
        macros are not shown here because those come from the server and this is before the
        request. Guessing them would put a figure on screen that the response might contradict.
      */}
      {valid ? (
        <p className="portion-step__preview">
          Θα προστεθεί:{' '}
          <strong>
            {portion
              ? `${formatQuantity(parsed)} × ${portion.label} · ${formatGrams(parsed * portion.grams)} g`
              : `${formatQuantity(parsed)} × 100 g`}
          </strong>
        </p>
      ) : null}

      <div className="dialog__actions">
        <button type="button" className="button button--secondary" onClick={onBack}>
          {strings.common.back}
        </button>
        <button
          type="button"
          className="button button--primary"
          disabled={!valid || busy}
          onClick={() =>
            onAdd({
              foodId: food.id,
              portionId: portionId ?? undefined,
              quantity: parsed,
            })
          }
        >
          {busy ? strings.common.saving : strings.common.add}
        </button>
      </div>
    </div>
  );
}
