import type { EnergyRequirementResponse, MacroDistributionResponse } from '@/api/types';
import {
  basisLabel,
  formatFactor,
  formatGrams,
  formatKcal,
  formatSignedKcal,
} from './nutritionLabels';
import './nutrition.css';

/**
 * The working, shown.
 *
 * A practitioner has to be able to explain a target to the person following it — "why 1.850?" is
 * a question asked across the desk, and "the software said so" is not an answer anyone can act
 * on. The API returns every intermediate value precisely so this panel can exist, and every
 * figure below is read from the response rather than recomputed here.
 *
 * It is laid out as a derivation, one line per step, so it reads the way it would be explained.
 */
export function EnergyDerivation({ result }: { result: EnergyRequirementResponse }) {
  const basis = basisLabel(result.basis);
  const stated = result.basis === 'DIRECT';

  return (
    <div className="derivation">
      <h3 className="derivation__title">Πώς προκύπτει</h3>

      <ol className="derivation__steps">
        {result.bmrKcal !== null ? (
          <li className="derivation__step">
            <span className="derivation__label">
              Βασικός μεταβολισμός
              {basis ? <span className="derivation__note">{basis}</span> : null}
            </span>
            <span className="derivation__value">{formatKcal(result.bmrKcal)} kcal</span>
          </li>
        ) : null}

        {result.activityFactor !== null ? (
          <li className="derivation__step">
            <span className="derivation__label">Συντελεστής δραστηριότητας</span>
            {/*
              The multiplier, not the product — the product is the maintenance line below, and
              printing it twice in consecutive rows reads as a repetition rather than a step.

              Formatted rather than interpolated: a raw 1.375 renders with a full stop, which in
              Greek is the thousands separator. "×1.375" says one thousand three hundred and
              seventy-five to the practitioner reading it out.
            */}
            <span className="derivation__value derivation__value--muted">
              × {formatFactor(result.activityFactor)}
            </span>
          </li>
        ) : null}

        {stated ? (
          <li className="derivation__step">
            <span className="derivation__label">
              Ενεργειακός στόχος
              {basis ? <span className="derivation__note">{basis}</span> : null}
            </span>
            <span className="derivation__value">{formatKcal(result.maintenanceKcal)} kcal</span>
          </li>
        ) : (
          <li className="derivation__step">
            <span className="derivation__label">
              Συντήρηση
              <span className="derivation__note">Θερμίδες για σταθερό βάρος</span>
            </span>
            <span className="derivation__value">{formatKcal(result.maintenanceKcal)} kcal</span>
          </li>
        )}

        {result.weightGoalAdjustmentKcal !== 0 ? (
          <li className="derivation__step">
            <span className="derivation__label">
              Προσαρμογή για τον στόχο βάρους
              <span className="derivation__note">
                {result.weightGoalAdjustmentKcal < 0 ? 'Έλλειμμα' : 'Πλεόνασμα'} ανά ημέρα
              </span>
            </span>
            <span className="derivation__value">
              {formatSignedKcal(result.weightGoalAdjustmentKcal)} kcal
            </span>
          </li>
        ) : null}
      </ol>

      <p className="derivation__total">
        <span>Ημερήσιος στόχος</span>
        <strong>{formatKcal(result.targetKcal)} kcal</strong>
      </p>

      <BelowBasalNotice result={result} />
    </div>
  );
}

/**
 * Says so when the target has fallen below the client's own basal metabolic rate.
 *
 * An aggressive weight goal over a short period produces this quietly: −4 kg in 30 days is about
 * −1.030 kcal a day, which can take a maintenance figure of 1.900 down to 870. The arithmetic is
 * correct and the result is not something to prescribe without knowing you have.
 *
 * This does not block, disable, or second-guess. The practitioner is the clinician and there are
 * legitimate reasons to go there under supervision. It states a fact the numbers already contain,
 * because the alternative is software that hands over a very-low-calorie target with the same
 * blank face it uses for 2.100.
 *
 * The comparison is between two figures the server returned. Nothing is computed here.
 */
function BelowBasalNotice({ result }: { result: EnergyRequirementResponse }) {
  if (result.bmrKcal === null || result.targetKcal >= result.bmrKcal) {
    return null;
  }

  return (
    <p className="derivation__warning" role="status">
      <span aria-hidden="true">⚠ </span>
      Ο στόχος είναι κάτω από τον βασικό μεταβολισμό ({formatKcal(result.bmrKcal)} kcal).
      Εξετάστε ηπιότερο ρυθμό ή μεγαλύτερο διάστημα.
    </p>
  );
}

/**
 * The macro split, with grams and kilocalories side by side.
 *
 * Both are shown because both get used: grams are what a plan is built from, kilocalories are
 * what the percentages mean. The server returns both, so neither is derived here — which matters,
 * because grams × 4 does not reproduce the server's kcal exactly once rounding has happened, and
 * a table that disagrees with itself is worse than one number.
 */
export function MacroBreakdown({ result }: { result: MacroDistributionResponse }) {
  const macros = [
    { label: 'Υδατάνθρακες', grams: result.carbohydrateG, kcal: result.carbohydrateKcal },
    { label: 'Πρωτεΐνη', grams: result.proteinG, kcal: result.proteinKcal },
    { label: 'Λίπος', grams: result.fatG, kcal: result.fatKcal },
  ];

  return (
    <div className="derivation">
      <h3 className="derivation__title">Κατανομή μακροθρεπτικών</h3>

      <div className="table-scroll">
        <table className="table">
          <caption className="visually-hidden">Κατανομή μακροθρεπτικών συστατικών</caption>
          <thead>
            <tr>
              <th scope="col">Μακροθρεπτικό</th>
              <th scope="col">Γραμμάρια</th>
              <th scope="col">Θερμίδες</th>
            </tr>
          </thead>
          <tbody>
            {macros.map((macro) => (
              <tr key={macro.label}>
                <th scope="row">{macro.label}</th>
                <td className="numeric">{formatGrams(macro.grams)} g</td>
                <td className="numeric">{formatKcal(macro.kcal)} kcal</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Σύνολο</th>
              <td />
              <td className="numeric">
                <strong>{formatKcal(result.targetKcal)} kcal</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
