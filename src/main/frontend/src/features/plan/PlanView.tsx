import type { MacroTotals, PlanDayResponse, PlanMealResponse, PlanResponse } from '@/api/types';
import { type ItemActions } from './ItemRow';
import { MacroProgress } from './MacroProgress';
import { SortableItems } from './SortableItems';
import { dayLabel, formatKcal, mealLabel } from './planLabels';
import './plan.css';

/**
 * A plan, rendered.
 *
 * Every number below is read from the response. Not one is added, multiplied or converted here —
 * meal totals, day totals, the percentage of target and the daily average all arrive computed.
 * That is what keeps the screen and the PDF and the database saying the same thing.
 *
 * 7c–7g make this editable. The read-only shape came first because everything else is a change
 * to it.
 */
interface PlanViewProps {
  plan: PlanResponse;
  /** Opens the food picker for a meal. Omitted renders the plan read-only. */
  onAddFood?: (day: PlanDayResponse, meal: PlanMealResponse) => void;
  /** The meal currently waiting on a request, so it can show as pending rather than as done. */
  pendingMealId?: number | null;
  /** Per-item editing. Omitted leaves the items read-only. */
  itemActions?: ItemActions;
  /** Reordering within a meal. Receives the meal's complete item list in its new order. */
  onReorder?: (mealId: number, orderedItemIds: number[]) => void;
  /** Empties a day. Offered only where there is something to empty. */
  onClearDay?: (day: PlanDayResponse) => void;
}

export function PlanView({
  plan,
  onAddFood,
  pendingMealId,
  itemActions,
  onReorder,
  onClearDay,
}: PlanViewProps) {
  return (
    <div className="plan">
      {plan.days.map((day) => (
        <PlanDay
          key={day.id}
          day={day}
          targets={plan.targets}
          onAddFood={onAddFood}
          pendingMealId={pendingMealId}
          itemActions={itemActions}
          onReorder={onReorder}
          onClearDay={onClearDay}
        />
      ))}
    </div>
  );
}

function PlanDay({
  day,
  targets,
  onAddFood,
  pendingMealId,
  itemActions,
  onReorder,
  onClearDay,
}: {
  day: PlanDayResponse;
  targets: MacroTotals;
  onAddFood?: PlanViewProps['onAddFood'];
  pendingMealId?: number | null;
  itemActions?: ItemActions;
  onReorder?: PlanViewProps['onReorder'];
  onClearDay?: PlanViewProps['onClearDay'];
}) {
  const empty = day.meals.every((meal) => meal.items.length === 0);

  return (
    <section className="day" aria-labelledby={`day-${day.id}`}>
      <header className="day__header">
        <h3 className="day__title" id={`day-${day.id}`}>
          {dayLabel(day)}
        </h3>
        <MacroProgress totals={day.totals} percent={day.targetPercent} targets={targets} />

        {/* Offered only when the day has something in it — a control that would do nothing is
            noise on six other days. */}
        {onClearDay && !empty ? (
          <button type="button" className="day__clear" onClick={() => onClearDay(day)}>
            Καθαρισμός ημέρας
            <span className="visually-hidden">: {dayLabel(day)}</span>
          </button>
        ) : null}
      </header>

      {/*
        The meals are always rendered, including on a day with nothing in it. They are the shape
        of the day and the place food gets added — collapsing them to a single "nothing here yet"
        line would leave a brand-new plan with nowhere to start.
      */}
      <div className="day__meals">
        {day.meals.map((meal) => (
          <Meal
            key={meal.id}
            meal={meal}
            onAddFood={onAddFood ? () => onAddFood(day, meal) : undefined}
            pending={pendingMealId === meal.id}
            itemActions={itemActions}
            onReorder={onReorder}
          />
        ))}
      </div>

      {empty ? (
        <p className="day__empty">Δεν έχουν προστεθεί τρόφιμα σε αυτή την ημέρα.</p>
      ) : null}
    </section>
  );
}

function Meal({
  meal,
  onAddFood,
  pending,
  itemActions,
  onReorder,
}: {
  meal: PlanMealResponse;
  onAddFood?: () => void;
  pending?: boolean;
  itemActions?: ItemActions;
  onReorder?: PlanViewProps['onReorder'];
}) {
  return (
    <section
      className={`meal${pending ? ' meal--pending' : ''}`}
      aria-labelledby={`meal-${meal.id}`}
      aria-busy={pending || undefined}
    >
      <header className="meal__header">
        <h4 className="meal__title" id={`meal-${meal.id}`}>
          {mealLabel(meal.mealType)}
          {meal.timeLabel ? <span className="meal__time">{meal.timeLabel}</span> : null}
        </h4>
        {meal.items.length > 0 ? (
          <span className="meal__total">{formatKcal(meal.totals.energyKcal)} kcal</span>
        ) : null}
      </header>

      {meal.items.length === 0 && !pending ? (
        // Empty meals are shown rather than hidden: the slots are the shape of the day, and a
        // practitioner scanning for what is missing needs to see the gap.
        <p className="meal__empty">—</p>
      ) : (
        <SortableItems
          items={meal.items}
          actions={itemActions}
          onReorder={onReorder ? (ids) => onReorder(meal.id, ids) : undefined}
        />
      )}

      {/*
        Pending is shown, never guessed at. The new item's own figures are not drawn here because
        they do not exist yet — the server computes them — and a placeholder that turns out wrong
        is the failure the whole design avoids.
      */}
      {pending ? (
        <p className="meal__pending" role="status">
          Προσθήκη…
        </p>
      ) : null}

      {onAddFood ? (
        <button
          type="button"
          className="meal__add"
          onClick={onAddFood}
          disabled={pending}
        >
          <span aria-hidden="true">+ </span>
          Προσθήκη
          <span className="visually-hidden"> τροφίμου στο γεύμα {mealLabel(meal.mealType)}</span>
        </button>
      ) : null}
    </section>
  );
}

