import type { MacroTotals, PlanDayResponse, PlanMealResponse, PlanResponse } from '@/api/types';
import {
  dayLabel,
  formatGrams,
  formatKcal,
  formatPercent,
  mealLabel,
  portionSummary,
} from './planLabels';
import './plan.css';

/**
 * A plan, rendered.
 *
 * Every number below is read from the response. Not one is added, multiplied or converted here —
 * meal totals, day totals, the percentage of target and the daily average all arrive computed.
 * That is what keeps the screen and the PDF and the database saying the same thing.
 *
 * 7b replaces the bare percentages with progress bars, and 7c–7g make this editable. The
 * read-only shape comes first because everything else is a change to it.
 */
export function PlanView({ plan }: { plan: PlanResponse }) {
  return (
    <div className="plan">
      {plan.days.map((day) => (
        <PlanDay key={day.id} day={day} />
      ))}
    </div>
  );
}

function PlanDay({ day }: { day: PlanDayResponse }) {
  const empty = day.meals.every((meal) => meal.items.length === 0);

  return (
    <section className="day" aria-labelledby={`day-${day.id}`}>
      <header className="day__header">
        <h3 className="day__title" id={`day-${day.id}`}>
          {dayLabel(day)}
        </h3>
        <MacroSummary totals={day.totals} percent={day.targetPercent} />
      </header>

      {/*
        The meals are always rendered, including on a day with nothing in it. They are the shape
        of the day and the place food gets added — collapsing them to a single "nothing here yet"
        line would leave a brand-new plan with nowhere to start.
      */}
      <div className="day__meals">
        {day.meals.map((meal) => (
          <Meal key={meal.id} meal={meal} />
        ))}
      </div>

      {empty ? (
        <p className="day__empty">Δεν έχουν προστεθεί τρόφιμα σε αυτή την ημέρα.</p>
      ) : null}
    </section>
  );
}

function Meal({ meal }: { meal: PlanMealResponse }) {
  return (
    <section className="meal" aria-labelledby={`meal-${meal.id}`}>
      <header className="meal__header">
        <h4 className="meal__title" id={`meal-${meal.id}`}>
          {mealLabel(meal.mealType)}
          {meal.timeLabel ? <span className="meal__time">{meal.timeLabel}</span> : null}
        </h4>
        {meal.items.length > 0 ? (
          <span className="meal__total">{formatKcal(meal.totals.energyKcal)} kcal</span>
        ) : null}
      </header>

      {meal.items.length === 0 ? (
        // Empty meals are shown rather than hidden: the six slots are the shape of the day, and
        // a practitioner scanning for what is missing needs to see the gap.
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
    </section>
  );
}

/**
 * A day's totals with its percentage of target.
 *
 * The percentages come from `targetPercent` on the response. Computing them here from totals and
 * targets would be a second implementation of the same arithmetic, and the two would disagree at
 * the rounding boundary — which is the disagreement this whole design exists to prevent.
 */
function MacroSummary({ totals, percent }: { totals: MacroTotals; percent: MacroTotals }) {
  // Short words rather than initials. "Π / Υ / Λ" needs a legend nobody reads, and an <abbr>
  // title is invisible on a tablet, which is an explicitly supported way of working.
  const macros = [
    { label: 'Ενέργεια', value: formatKcal(totals.energyKcal), unit: 'kcal', pct: percent.energyKcal },
    { label: 'Πρωτ.', value: formatGrams(totals.proteinG), unit: 'g', pct: percent.proteinG },
    { label: 'Υδατ.', value: formatGrams(totals.carbohydrateG), unit: 'g', pct: percent.carbohydrateG },
    { label: 'Λίπος', value: formatGrams(totals.fatG), unit: 'g', pct: percent.fatG },
  ];

  return (
    <dl className="macro-summary">
      {macros.map((macro) => (
        <div className="macro-summary__item" key={macro.label}>
          <dt>{macro.label}</dt>
          <dd>
            <span className="macro-summary__value">
              {macro.value} <span className="macro-summary__unit">{macro.unit}</span>
            </span>
            <span className="macro-summary__pct">{formatPercent(macro.pct)}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
