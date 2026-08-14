import { useState } from 'react';

import { messageFor } from '@/api/messages';
import type { IsoDate, MeasurementTypeResponse } from '@/api/types';
import { TextField } from '@/components/form/TextField';
import { strings } from '@/strings';
import { CATEGORY_LABELS, todayIso } from './measurementFormat';
import { useRecordMeasurement } from './measurementQueries';
import './measurement.css';

interface SingleMeasurementFormProps {
  clientId: number;
  types: MeasurementTypeResponse[];
  onDone: () => void;
}

/**
 * One value, with a note.
 *
 * The visit form is the fast path and covers almost everything, but it cannot carry notes — the
 * batch endpoint takes only a type and a value. A note belongs to an individual reading ("μετά
 * από γεύμα", "διαφορετική ζυγαριά") and is exactly the context that makes an odd number
 * readable a month later, so there has to be a way to record one.
 */
export function SingleMeasurementForm({ clientId, types, onDone }: SingleMeasurementFormProps) {
  const [typeCode, setTypeCode] = useState('');
  const [value, setValue] = useState('');
  const [recordedOn, setRecordedOn] = useState(todayIso());
  const [notes, setNotes] = useState('');

  const record = useRecordMeasurement(clientId);
  const selected = types.find((type) => type.code === typeCode);

  const parsed = Number(value);
  const valueIsUsable = value.trim() !== '' && Number.isFinite(parsed);
  const notesTooLong = notes.length > 500;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !valueIsUsable || notesTooLong) {
      return;
    }

    record.mutate(
      {
        clientId,
        typeCode,
        value: parsed,
        recordedOn: recordedOn as IsoDate,
        notes: notes.trim() || undefined,
      },
      { onSuccess: onDone },
    );
  }

  return (
    <form className="visit-form" onSubmit={submit} noValidate>
      <h2 className="section-title">Μεμονωμένη μέτρηση</h2>

      {record.error ? (
        <p className="form-error" role="alert">
          {messageFor(record.error)}
        </p>
      ) : null}

      <div className="field">
        <label className="field__label" htmlFor="single-type">
          Τύπος μέτρησης<span className="field__required" aria-hidden="true"> *</span>
        </label>
        <select
          id="single-type"
          className="field__input"
          value={typeCode}
          onChange={(event) => setTypeCode(event.target.value)}
          required
        >
          <option value="">Επιλέξτε…</option>
          {/* Grouped, so fourteen options are scannable rather than a flat list. */}
          {[...new Set(types.map((type) => type.category))].map((category) => (
            <optgroup key={category} label={CATEGORY_LABELS[category] ?? category}>
              {types
                .filter((type) => type.category === category)
                .map((type) => (
                  <option key={type.code} value={type.code}>
                    {type.labelEl} ({type.unit})
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>

      <TextField
        label={selected ? `Τιμή (${selected.unit})` : 'Τιμή'}
        type="number"
        inputMode="decimal"
        step={
          selected === undefined || selected.decimals === 0
            ? '1'
            : `0.${'0'.repeat(selected.decimals - 1)}1`
        }
        min="0"
        required
        disabled={!selected}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        error={value.trim() !== '' && !valueIsUsable ? 'Μη έγκυρη τιμή' : undefined}
      />

      <TextField
        label="Ημερομηνία"
        type="date"
        max={todayIso()}
        value={recordedOn}
        onChange={(event) => setRecordedOn(event.target.value)}
      />

      <div className="field">
        <label className="field__label" htmlFor="single-notes">
          Σημείωση
        </label>
        <textarea
          id="single-notes"
          className="field__input"
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          aria-invalid={notesTooLong || undefined}
          aria-describedby="single-notes-count"
        />
        <p className={`field__hint${notesTooLong ? ' field__error' : ''}`} id="single-notes-count">
          {notes.length} / 500
        </p>
      </div>

      <div className="visit-form__actions">
        <button type="button" className="button button--secondary" onClick={onDone}>
          {strings.common.cancel}
        </button>
        <button
          type="submit"
          className="button button--primary"
          disabled={!selected || !valueIsUsable || notesTooLong || record.isPending}
        >
          {record.isPending ? strings.common.saving : strings.common.save}
        </button>
      </div>
    </form>
  );
}
