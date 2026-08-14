import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { messageFor } from '@/api/messages';
import type { EnergyRequirementRequest } from '@/api/types';
import { ErrorState, Loading } from '@/components/states';
import { TextField } from '@/components/form/TextField';
import { useDebounced } from '@/components/useDebounced';
import { useClient } from '@/features/client/clientQueries';
import { useMeasurementSummary } from '@/features/measurement/measurementQueries';
import { EnergyBasisForm, type EnergyInputs } from './EnergyBasisForm';
import { EnergyDerivation, MacroBreakdown } from './Derivation';
import { ageFromDateOfBirth, formatKcal } from './nutritionLabels';
import {
  useActivityLevels,
  useCoefficientRequirement,
  useEnergyRequirement,
  useMacroDistribution,
} from './nutritionQueries';
import './nutrition.css';

type SplitMode = 'percent' | 'coefficient';

const INITIAL: EnergyInputs = {
  mode: 'equation',
  equation: 'MIFFLIN_ST_JEOR',
  sex: '',
  weightKg: '',
  heightCm: '',
  ageYears: '',
  manualBmrKcal: '',
  manualEnergyKcal: '',
  activityFactor: '1.375',
  targetWeightChangeKg: '',
  periodDays: '30',
};

export function TargetsTab() {
  const clientId = Number(useParams().clientId);

  const client = useClient(clientId);
  const measurements = useMeasurementSummary(clientId);
  const activityLevels = useActivityLevels();

  const [inputs, setInputs] = useState<EnergyInputs>(INITIAL);
  const [prefilled, setPrefilled] = useState(false);

  const [splitMode, setSplitMode] = useState<SplitMode>('percent');
  const [percents, setPercents] = useState({ carb: '50', protein: '20', fat: '30' });
  const [coefficients, setCoefficients] = useState({ carb: '3', protein: '1.6', fat: '1' });

  const energy = useEnergyRequirement();
  const macros = useMacroDistribution();
  const fromCoefficients = useCoefficientRequirement();

  // Seed the anthropometrics from what is already known about this client. Done once, and only
  // into fields the practitioner has not touched — re-running it on every measurement refetch
  // would overwrite a figure they had deliberately changed.
  useEffect(() => {
    if (prefilled || !client.data || !measurements.data) {
      return;
    }

    const latest = (code: string) =>
      measurements.data.latest.find((entry) => entry.typeCode === code)?.value;
    const weight = latest('WEIGHT');
    const height = latest('HEIGHT');
    const age = ageFromDateOfBirth(client.data.dateOfBirth);

    if (weight === undefined && height === undefined && age === null) {
      return;
    }

    setInputs((current) => ({
      ...current,
      weightKg: current.weightKg || (weight !== undefined ? String(weight) : ''),
      heightCm: current.heightCm || (height !== undefined ? String(height) : ''),
      ageYears: current.ageYears || (age !== null ? String(age) : ''),
    }));
    setPrefilled(true);
  }, [client.data, measurements.data, prefilled]);

  // Every recalculation is a round trip, so the inputs settle first. Without this a practitioner
  // typing "1850" fires four requests and watches three wrong answers on the way to the right one.
  const settled = useDebounced(inputs, 400);
  const energyRequest = useMemo(() => buildEnergyRequest(settled), [settled]);

  const runEnergy = energy.mutate;
  useEffect(() => {
    if (energyRequest) {
      runEnergy(energyRequest);
    }
  }, [energyRequest, runEnergy]);

  const targetKcal = energy.data?.targetKcal ?? null;

  const settledPercents = useDebounced(percents, 400);
  const settledCoefficients = useDebounced(coefficients, 400);

  // The percentages are the practitioner's own inputs echoed back, not a nutrient value — the
  // server still validates the total and every gram figure comes from it.
  const percentTotal =
    Number(settledPercents.carb || 0) +
    Number(settledPercents.protein || 0) +
    Number(settledPercents.fat || 0);
  const percentTotalOk = Math.abs(percentTotal - 100) <= 0.1;

  const runMacros = macros.mutate;
  const runCoefficients = fromCoefficients.mutate;

  useEffect(() => {
    if (splitMode !== 'percent' || targetKcal === null || !percentTotalOk) {
      return;
    }
    runMacros({
      targetKcal,
      carbohydratePercent: Number(settledPercents.carb),
      proteinPercent: Number(settledPercents.protein),
      fatPercent: Number(settledPercents.fat),
    });
  }, [splitMode, targetKcal, percentTotalOk, settledPercents, runMacros]);

  useEffect(() => {
    if (splitMode !== 'coefficient') {
      return;
    }
    const weight = Number(settled.weightKg);
    if (!Number.isFinite(weight) || weight < 20) {
      return;
    }
    runCoefficients({
      weightKg: weight,
      carbohydrateGPerKg: Number(settledCoefficients.carb || 0),
      proteinGPerKg: Number(settledCoefficients.protein || 0),
      fatGPerKg: Number(settledCoefficients.fat || 0),
    });
  }, [splitMode, settled.weightKg, settledCoefficients, runCoefficients]);

  if (activityLevels.isPending || client.isPending) {
    return <Loading />;
  }
  if (activityLevels.error) {
    return <ErrorState error={activityLevels.error} onRetry={() => void activityLevels.refetch()} />;
  }

  const splitResult = splitMode === 'percent' ? macros.data : fromCoefficients.data;
  const splitError = splitMode === 'percent' ? macros.error : fromCoefficients.error;

  return (
    <div className="calc">
      <div className="calc__forms">
        <EnergyBasisForm
          inputs={inputs}
          onChange={(patch) => setInputs((current) => ({ ...current, ...patch }))}
          activityLevels={activityLevels.data}
          prefilled={prefilled}
        />

        <section className="calc__section" aria-labelledby="split-heading">
          <h2 className="section-title" id="split-heading">
            2 · Κατανομή μακροθρεπτικών
          </h2>

          <fieldset className="calc__modes calc__modes--inline">
            <legend className="visually-hidden">Τρόπος κατανομής</legend>
            {(
              [
                ['percent', 'Ως ποσοστά της ενέργειας'],
                ['coefficient', 'Ως γραμμάρια ανά κιλό βάρους'],
              ] as const
            ).map(([mode, label]) => (
              <label
                className={`calc__mode${splitMode === mode ? ' calc__mode--on' : ''}`}
                key={mode}
              >
                <input
                  type="radio"
                  name="split-mode"
                  value={mode}
                  checked={splitMode === mode}
                  onChange={() => setSplitMode(mode)}
                />
                <span>
                  <strong>{label}</strong>
                </span>
              </label>
            ))}
          </fieldset>

          {splitMode === 'percent' ? (
            <>
              <div className="calc__row">
                <TextField
                  label="Υδατάνθρακες (%)"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={percents.carb}
                  onChange={(event) =>
                    setPercents((current) => ({ ...current, carb: event.target.value }))
                  }
                />
                <TextField
                  label="Πρωτεΐνη (%)"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={percents.protein}
                  onChange={(event) =>
                    setPercents((current) => ({ ...current, protein: event.target.value }))
                  }
                />
                <TextField
                  label="Λίπος (%)"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={percents.fat}
                  onChange={(event) =>
                    setPercents((current) => ({ ...current, fat: event.target.value }))
                  }
                />
              </div>

              {/* Says the total before submitting, rather than letting the server reject it. */}
              <p
                className={`calc__percent-total${percentTotalOk ? '' : ' calc__percent-total--off'}`}
                aria-live="polite"
              >
                {percentTotalOk ? (
                  <>Σύνολο 100%</>
                ) : (
                  <>
                    <span aria-hidden="true">⚠ </span>
                    Σύνολο {new Intl.NumberFormat('el-GR').format(percentTotal)}% — πρέπει να
                    αθροίζουν στο 100%
                  </>
                )}
              </p>
            </>
          ) : (
            <>
              <div className="calc__row">
                <TextField
                  label="Υδατάνθρακες (g/kg)"
                  type="number"
                  step="0.1"
                  min="0"
                  max="20"
                  value={coefficients.carb}
                  onChange={(event) =>
                    setCoefficients((current) => ({ ...current, carb: event.target.value }))
                  }
                />
                <TextField
                  label="Πρωτεΐνη (g/kg)"
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={coefficients.protein}
                  onChange={(event) =>
                    setCoefficients((current) => ({ ...current, protein: event.target.value }))
                  }
                />
                <TextField
                  label="Λίπος (g/kg)"
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={coefficients.fat}
                  onChange={(event) =>
                    setCoefficients((current) => ({ ...current, fat: event.target.value }))
                  }
                />
              </div>
              {/* Coefficients are the inverse of the percentage path: the energy total falls out
                  of the grams rather than the grams being carved out of a target. */}
              <p className="calc__hint">
                Ο ενεργειακός στόχος προκύπτει από τα γραμμάρια, βάσει βάρους{' '}
                {settled.weightKg || '—'} kg.
              </p>
            </>
          )}
        </section>
      </div>

      <aside className="calc__results" aria-live="polite">
        {energy.error ? <p className="form-error">{messageFor(energy.error)}</p> : null}

        {energy.data ? (
          <EnergyDerivation result={energy.data} />
        ) : (
          <p className="calc__waiting">
            Συμπληρώστε τα στοιχεία για να υπολογιστεί ο ημερήσιος στόχος.
          </p>
        )}

        {splitError ? <p className="form-error">{messageFor(splitError)}</p> : null}

        {splitResult ? <MacroBreakdown result={splitResult} /> : null}

        {/*
          The coefficient path produces its own energy total, which can differ from the target
          derived above. Saying so is the honest thing: the practitioner chose to prescribe grams,
          and the two numbers answer different questions.
        */}
        {splitMode === 'coefficient' && splitResult && targetKcal !== null &&
        splitResult.targetKcal !== targetKcal ? (
          <p className="calc__note">
            Οι συντελεστές δίνουν {formatKcal(splitResult.targetKcal)} kcal, ενώ ο στόχος από την
            ενεργειακή βάση είναι {formatKcal(targetKcal)} kcal.
          </p>
        ) : null}
      </aside>
    </div>
  );
}

/**
 * Turns the form into a request, or into null when it is not yet answerable.
 *
 * Returning null rather than a partial request is deliberate: the server rejects an incomplete
 * body with a validation error, and firing one on every keystroke would fill the panel with
 * complaints about fields the practitioner has not reached yet.
 */
function buildEnergyRequest(inputs: EnergyInputs): EnergyRequirementRequest | null {
  const number = (raw: string) => (raw.trim() === '' ? null : Number(raw));
  const usable = (value: number | null) => value !== null && Number.isFinite(value);

  const activityFactor = number(inputs.activityFactor);
  const weightChange = number(inputs.targetWeightChangeKg);
  const periodDays = number(inputs.periodDays);

  const goal = {
    ...(usable(weightChange) ? { targetWeightChangeKg: weightChange as number } : {}),
    ...(usable(periodDays) ? { periodDays: periodDays as number } : {}),
  };

  if (inputs.mode === 'directTarget') {
    const energyKcal = number(inputs.manualEnergyKcal);
    return usable(energyKcal) ? { manualEnergyKcal: energyKcal as number } : null;
  }

  if (!usable(activityFactor)) {
    return null;
  }

  if (inputs.mode === 'knownBmr') {
    const bmr = number(inputs.manualBmrKcal);
    return usable(bmr)
      ? { manualBmrKcal: bmr as number, activityFactor: activityFactor as number, ...goal }
      : null;
  }

  const weightKg = number(inputs.weightKg);
  const heightCm = number(inputs.heightCm);
  const ageYears = number(inputs.ageYears);

  if (!inputs.sex || !usable(weightKg) || !usable(heightCm) || !usable(ageYears)) {
    return null;
  }

  return {
    bmr: {
      equation: inputs.equation,
      sex: inputs.sex,
      weightKg: weightKg as number,
      heightCm: heightCm as number,
      ageYears: ageYears as number,
    },
    activityFactor: activityFactor as number,
    ...goal,
  };
}
