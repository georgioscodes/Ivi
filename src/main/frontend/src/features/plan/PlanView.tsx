import type { MacroTotals, PlanDayResponse, PlanMealResponse, PlanResponse } from '@/api/types';
import { MacroProgress } from './MacroProgress';
import { dayLabel, formatKcal, mealLabel, portionSummary } from './planLabels';
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
}

export function PlanView({ plan, onAddFood, pendingMealId }: PlanViewProps) {
  return (
    <div className="plan">
      {plan.days.map((day) => (
        <PlanDay
          key={day.id}
          day={day}
          targets={plan.targets}
          onAddFood={onAddFood}
          pendingMealId={pendingMealId}
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
}: {
  day: PlanDayResponse;
  targets: MacroTotals;
  onAddFood?: PlanViewProps['onAddFood'];
  pendingMealId?: number | null;
}) {
  const empty = day.meals.every((meal) => meal.items.length === 0);

  return (
    <section className="day" aria-labelledby={`day-${day.id}`}>
      <header className="day__header">
        <h3 className="day__title" id={`day-${day.id}`}>
          {dayLabel(day)}
        </h3>
        <MacroProgress totals={day.totals} percent={day.targetPercent} targets={targets} />
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
}: {
  meal: PlanMealResponse;
  onAddFood?: () => void;
  pending?: boolean;
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
        <ul className="meal__items">
          {meal.items.map((item) => (
            <li className="item" key={item.id}>
              <span className="item__name">
                {item.name}
                {/* The food was deleted from the catalogue after this was prescribed. The item
                    stands, because it is a record of what was recommended. */}
                {item.foodId === null ? (
                  <span className="item__orphan" title="Το τρόφιμο δεν υπάρχει πλέον στον κατάλογο">
                    {' '}
                    (εκτός καταλόγου)
                  </span>
                ) : null}
              </span>
              <span className="item__portion">{portionSummary(item)}</span>
              <span className="item__energy">{formatKcal(item.energyKcal)} kcal</span>
            </li>
          ))}
        </ul>
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

