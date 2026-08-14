import { useState } from 'react';

import { messageFor } from '@/api/messages';
import type { MeasurementTypeResponse } from '@/api/types';
import type { IsoDate } from '@/api/types';
import { strings } from '@/strings';
import { useRecordVisit } from './measurementQueries';
import { CATEGORY_LABELS, todayIso } from './measurementFormat';
import './measurement.css';

interface VisitEntryFormProps {
  clientId: number;
  types: MeasurementTypeResponse[];
  onDone: () => void;
}

/**
 * Every reading from one visit, on one screen, in one request.
 *
 * This is the form the product exists to make fast. A practitioner steps a client through the
 * scales and the tape measure and comes away with a dozen numbers; entering them one at a time
 * is a dozen navigations and a dozen round trips. Here it is one date, one pass down the list,
 * one save.
 *
 * Empty inputs are simply not sent. There is no "skip" control and no zero-filling: a
 * measurement that was not taken has no value, and 0 kg of muscle mass is not the same statement
 * as silence.
 */
export function VisitEntryForm({ clientId, types, onDone }: VisitEntryFormProps) {
  const [recordedOn, setRecordedOn] = useState(todayIso());
  const [values, setValues] = useState<Record<string, string>>({});
  const record = useRecordVisit(clientId);

  const grouped = groupByCategory(types);
  const filled = Object.entries(values).filter(([, raw]) => raw.trim() !== '');

  // The browser's number input accepts "1e5" and a lone "-". Parsing here rather than trusting
  // it means a malformed cell is caught before the whole visit is rejected by the server.
  const parsed = filled.map(([typeCode, raw]) => ({ typeCode, value: Number(raw) }));
  const invalid = parsed.filter((entry) => !Number.isFinite(entry.value));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (parsed.length === 0 || invalid.length > 0) {
      return;
    }

    record.mutate(
      { clientId, recordedOn: recordedOn as IsoDate, values: parsed },
      { onSuccess: onDone },
    );
  }

  return (
    <form className="visit-form" onSubmit={submit} noValidate>
      <div className="visit-form__head">
        <div className="field visit-form__date">
          <label className="field__label" htmlFor="visit-date">
            Ημερομηνία επίσκεψης
          </label>
          <input
            id="visit-date"
            type="date"
            className="field__input"
            value={recordedOn}
            max={todayIso()}
            onChange={(event) => setRecordedOn(event.target.value)}
          />
        </div>
        <p className="visit-form__hint">
          Συμπληρώστε μόνο όσα μετρήσατε. Τα κενά πεδία αγνοούνται.
        </p>
      </div>

      {record.error ? (
        <p className="form-error" role="alert">
          {messageFor(record.error)}
        </p>
      ) : null}

      {grouped.map(([category, categoryTypes]) => (
        <fieldset className="visit-form__group" key={category}>
          <legend className="visit-form__legend">{CATEGORY_LABELS[category] ?? category}</legend>

          <div className="visit-form__grid">
            {categoryTypes.map((type) => (
              <div className="field visit-form__cell" key={type.code}>
                <label className="field__label" htmlFor={`visit-${type.code}`}>
                  {type.labelEl}
                  <span className="visit-form__unit"> ({type.unit})</span>
                </label>
                <input
                  id={`visit-${type.code}`}
                  type="number"
                  inputMode="decimal"
                  // Derived from the type's own precision, so the control accepts exactly what
                  // the server stores rather than a guessed granularity.
                  step={type.decimals === 0 ? '1' : `0.${'0'.repeat(type.decimals - 1)}1`}
                  min="0"
                  className="field__input"
                  value={values[type.code] ?? ''}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [type.code]: event.target.value }))
                  }
                />
              </div>
            ))}
          </div>
        </fieldset>
      ))}

      <div className="visit-form__actions">
        {/* Says what will be saved. "Save" alone leaves the practitioner counting inputs. */}
        <span className="visit-form__count" aria-live="polite">
          {parsed.length === 0
            ? 'Καμία τιμή συμπληρωμένη'
            : `${parsed.length} ${parsed.length === 1 ? 'τιμή' : 'τιμές'} προς αποθήκευση`}
        </span>

        <button type="button" className="button button--secondary" onClick={onDone}>
          {strings.common.cancel}
        </button>
        <button
          type="submit"
          className="button button--primary"
          disabled={parsed.length === 0 || invalid.length > 0 || record.isPending}
        >
          {record.isPending ? strings.common.saving : strings.common.save}
        </button>
      </div>
    </form>
  );
}

/**
 * Groups by category, keeping the server's ordering within each. Insertion order is preserved by
 * Map, so the categories appear in the order the API returned them rather than alphabetically —
 * which happens to run head to toe.
 */
function groupByCategory(
  types: MeasurementTypeResponse[],
): [string, MeasurementTypeResponse[]][] {
  const groups = new Map<string, MeasurementTypeResponse[]>();
  for (const type of types) {
    const existing = groups.get(type.category);
    if (existing) {
      existing.push(type);
    } else {
      groups.set(type.category, [type]);
    }
  }
  return [...groups.entries()];
}
