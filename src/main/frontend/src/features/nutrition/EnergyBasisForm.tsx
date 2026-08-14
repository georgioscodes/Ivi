import type { ActivityLevelResponse, BmrEquation, Sex } from '@/api/types';
import { TextField } from '@/components/form/TextField';
import { EQUATIONS } from './nutritionLabels';
import './nutrition.css';

export type BasisMode = 'equation' | 'knownBmr' | 'directTarget';

export interface EnergyInputs {
  mode: BasisMode;
  equation: BmrEquation;
  sex: Sex | '';
  weightKg: string;
  heightCm: string;
  ageYears: string;
  manualBmrKcal: string;
  manualEnergyKcal: string;
  activityFactor: string;
  targetWeightChangeKg: string;
  periodDays: string;
}

interface EnergyBasisFormProps {
  inputs: EnergyInputs;
  onChange: (patch: Partial<EnergyInputs>) => void;
  activityLevels: ActivityLevelResponse[];
  /** True when weight, height or age were filled in from the client's own record. */
  prefilled: boolean;
}

/**
 * The three ways to arrive at a daily energy target.
 *
 * The server accepts exactly one of anthropometrics, a stated basal rate, or a stated target, and
 * rejects zero or two. Rather than let a practitioner assemble an invalid combination and read
 * about it afterwards, the choice is a radio group and only the selected path's fields appear.
 */
export function EnergyBasisForm({
  inputs,
  onChange,
  activityLevels,
  prefilled,
}: EnergyBasisFormProps) {
  const usesActivity = inputs.mode !== 'directTarget';

  return (
    <section className="calc__section" aria-labelledby="basis-heading">
      <h2 className="section-title" id="basis-heading">
        1 · Ενεργειακή βάση
      </h2>

      <fieldset className="calc__modes">
        <legend className="visually-hidden">Τρόπος υπολογισμού</legend>

        {(
          [
            ['equation', 'Από ανθρωπομετρικά', 'Υπολογισμός βασικού μεταβολισμού με εξίσωση'],
            ['knownBmr', 'Από γνωστό βασικό μεταβολισμό', 'Π.χ. από λιπομέτρηση ή έμμεση θερμιδομετρία'],
            ['directTarget', 'Απευθείας ενεργειακός στόχος', 'Δηλώνετε εσείς τις θερμίδες'],
          ] as const
        ).map(([mode, label, note]) => (
          <label className={`calc__mode${inputs.mode === mode ? ' calc__mode--on' : ''}`} key={mode}>
            <input
              type="radio"
              name="basis-mode"
              value={mode}
              checked={inputs.mode === mode}
              onChange={() => onChange({ mode })}
            />
            <span>
              <strong>{label}</strong>
              <span className="calc__mode-note">{note}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {inputs.mode === 'equation' ? (
        <>
          {prefilled ? (
            <p className="calc__prefill">
              Το βάρος, το ύψος και η ηλικία συμπληρώθηκαν από την καρτέλα του πελάτη. Μπορείτε να
              τα αλλάξετε.
            </p>
          ) : null}

          <div className="field">
            <label className="field__label" htmlFor="equation">
              Εξίσωση
            </label>
            <select
              id="equation"
              className="field__input"
              value={inputs.equation}
              onChange={(event) => onChange({ equation: event.target.value as BmrEquation })}
            >
              {EQUATIONS.map((equation) => (
                <option key={equation.code} value={equation.code}>
                  {equation.name} — {equation.note}
                </option>
              ))}
            </select>
          </div>

          <div className="calc__row">
            <div className="field">
              <label className="field__label" htmlFor="sex">
                Φύλο<span className="field__required" aria-hidden="true"> *</span>
              </label>
              <select
                id="sex"
                className="field__input"
                value={inputs.sex}
                onChange={(event) => onChange({ sex: event.target.value as Sex })}
                required
              >
                <option value="">Επιλέξτε…</option>
                <option value="FEMALE">Γυναίκα</option>
                <option value="MALE">Άνδρας</option>
              </select>
              {/*
                Not on the client record, so it cannot be prefilled and has to be asked every
                time. Every one of the three equations is sex-specific, so there is no default
                that would not be a guess about a person.
              */}
              <p className="field__hint">Απαιτείται από όλες τις εξισώσεις</p>
            </div>

            <TextField
              label="Βάρος (kg)"
              type="number"
              step="0.1"
              min="20"
              max="400"
              required
              value={inputs.weightKg}
              onChange={(event) => onChange({ weightKg: event.target.value })}
            />
            <TextField
              label="Ύψος (cm)"
              type="number"
              step="0.1"
              min="80"
              max="250"
              required
              value={inputs.heightCm}
              onChange={(event) => onChange({ heightCm: event.target.value })}
            />
            <TextField
              label="Ηλικία (έτη)"
              type="number"
              step="1"
              min="1"
              max="120"
              required
              value={inputs.ageYears}
              onChange={(event) => onChange({ ageYears: event.target.value })}
            />
          </div>
        </>
      ) : null}

      {inputs.mode === 'knownBmr' ? (
        <TextField
          label="Βασικός μεταβολισμός (kcal)"
          type="number"
          step="1"
          min="400"
          max="5000"
          required
          value={inputs.manualBmrKcal}
          onChange={(event) => onChange({ manualBmrKcal: event.target.value })}
        />
      ) : null}

      {inputs.mode === 'directTarget' ? (
        <TextField
          label="Ενεργειακός στόχος (kcal/ημέρα)"
          type="number"
          step="1"
          min="400"
          max="10000"
          required
          hint="Ο συντελεστής δραστηριότητας και ο στόχος βάρους δεν εφαρμόζονται σε αυτή την επιλογή"
          value={inputs.manualEnergyKcal}
          onChange={(event) => onChange({ manualEnergyKcal: event.target.value })}
        />
      ) : null}

      {usesActivity ? (
        <>
          <h3 className="calc__subheading">Επίπεδο δραστηριότητας</h3>
          <div className="calc__row">
            <div className="field">
              <label className="field__label" htmlFor="activity-preset">
                Προτεινόμενα επίπεδα
              </label>
              <select
                id="activity-preset"
                className="field__input"
                value={
                  activityLevels.some((level) => String(level.factor) === inputs.activityFactor)
                    ? inputs.activityFactor
                    : ''
                }
                onChange={(event) => onChange({ activityFactor: event.target.value })}
              >
                <option value="">Προσαρμοσμένος συντελεστής</option>
                {activityLevels.map((level) => (
                  <option key={level.code} value={String(level.factor)}>
                    {level.labelEl} ({level.factor})
                  </option>
                ))}
              </select>
            </div>

            {/*
              The endpoint offers suggestions; the calculation accepts anything from 1.0 to 3.0.
              Reducing that to a six-item menu would take a judgement away from the practitioner —
              somebody with a reason to use 1.45 should be able to type it.
            */}
            <TextField
              label="Συντελεστής"
              type="number"
              step="0.001"
              min="1"
              max="3"
              required
              hint="Οποιαδήποτε τιμή από 1,0 έως 3,0"
              value={inputs.activityFactor}
              onChange={(event) => onChange({ activityFactor: event.target.value })}
            />
          </div>

          <h3 className="calc__subheading">Στόχος βάρους</h3>
          <div className="calc__row">
            <TextField
              label="Μεταβολή βάρους (kg)"
              type="number"
              step="0.1"
              min="-10"
              max="10"
              // The sign is the entire meaning of this field, so it is spelled out rather than
              // left to a minus key the practitioner may not think to press.
              hint="Αρνητικό για απώλεια (π.χ. −4), θετικό για αύξηση"
              value={inputs.targetWeightChangeKg}
              onChange={(event) => onChange({ targetWeightChangeKg: event.target.value })}
            />
            <TextField
              label="Σε διάστημα (ημέρες)"
              type="number"
              step="1"
              min="1"
              hint="Προεπιλογή 30 ημέρες"
              value={inputs.periodDays}
              onChange={(event) => onChange({ periodDays: event.target.value })}
            />
          </div>
        </>
      ) : null}
    </section>
  );
}
