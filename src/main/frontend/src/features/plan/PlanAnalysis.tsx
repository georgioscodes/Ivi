import type { MacroTotals, PlanResponse } from '@/api/types';
import { dayLabel, formatGrams, formatKcal, formatPercent } from './planLabels';
import './plan.css';

/**
 * Every day of the plan, side by side, against the targets.
 *
 * The per-day bars already say whether *a* day works. What they cannot show is the shape of the
 * week: which day is the light one, whether protein sags on the days without a snack, whether the
 * two rest days are actually different from each other. That needs the days on adjacent rows, and
 * it is the question a practitioner has once the food is in.
 *
 * As everywhere else in the builder, not one figure here is derived. The values are the day totals
 * the server sent, the percentages are `targetPercent` per day and `dailyAveragePercent` for the
 * average row. The browser does not divide, subtract or compare — it only decides where to put
 * what it was given.
 */
export function PlanAnalysis({ plan }: { plan: PlanResponse }) {
  return (
    <section className="analysis" aria-labelledby="analysis-heading">
      <h2 className="section-title" id="analysis-heading">
        Σύνοψη ημερών
      </h2>

      {/* The table is wider than a tablet in portrait, so it scrolls in its own box rather than
          pushing the page sideways. */}
      <div className="analysis__scroll" tabIndex={0} role="group" aria-labelledby="analysis-heading">
        <table className="analysis__table">
          <caption className="visually-hidden">
            Σύνολα ανά ημέρα και ποσοστό επίτευξης των ημερήσιων στόχων, με τον μέσο όρο του πλάνου
            στην τελευταία γραμμή.
          </caption>
          <thead>
            <tr>
              <th scope="col">Ημέρα</th>
              <th scope="col">
                Ενέργεια <span className="analysis__unit">kcal</span>
              </th>
              <th scope="col">
                Πρωτεΐνη <span className="analysis__unit">g</span>
              </th>
              <th scope="col">
                Υδατάνθρακες <span className="analysis__unit">g</span>
              </th>
              <th scope="col">
                Λίπος <span className="analysis__unit">g</span>
              </th>
            </tr>
          </thead>

          <tbody>
            <tr className="analysis__row analysis__row--target">
              <th scope="row">Στόχος</th>
              <td>{formatKcal(plan.targets.energyKcal)}</td>
              <td>{formatGrams(plan.targets.proteinG)}</td>
              <td>{formatGrams(plan.targets.carbohydrateG)}</td>
              <td>{formatGrams(plan.targets.fatG)}</td>
            </tr>

            {plan.days.map((day) => (
              <tr key={day.id} className="analysis__row">
                <th scope="row">{dayLabel(day)}</th>
                <MacroCells totals={day.totals} percent={day.targetPercent} />
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="analysis__row analysis__row--average">
              <th scope="row">
                Μέσος όρος
                <span className="analysis__row-note">
                  {plan.days.length} {plan.days.length === 1 ? 'ημέρα' : 'ημέρες'}
                </span>
              </th>
              <MacroCells totals={plan.dailyAverage} percent={plan.dailyAveragePercent} />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function MacroCells({ totals, percent }: { totals: MacroTotals; percent: MacroTotals }) {
  return (
    <>
      <Cell value={formatKcal(totals.energyKcal)} pct={percent.energyKcal} />
      <Cell value={formatGrams(totals.proteinG)} pct={percent.proteinG} />
      <Cell value={formatGrams(totals.carbohydrateG)} pct={percent.carbohydrateG} />
      <Cell value={formatGrams(totals.fatG)} pct={percent.fatG} />
    </>
  );
}

function Cell({ value, pct }: { value: string; pct: number }) {
  const over = pct > 100;

  return (
    <td className={`analysis__cell${over ? ' analysis__cell--over' : ''}`}>
      <span className="analysis__value">{value}</span>
      {/*
        Over target is never carried by colour alone — the warning glyph has a text equivalent for
        anyone who cannot see either. Same rule as the day bars, and for the same reason: this
        table is also what gets printed and photocopied.
      */}
      <span className="analysis__pct">
        {over ? <span aria-hidden="true">⚠ </span> : null}
        {formatPercent(pct)}
        {over ? <span className="visually-hidden">, πάνω από τον στόχο</span> : null}
      </span>
    </td>
  );
}
