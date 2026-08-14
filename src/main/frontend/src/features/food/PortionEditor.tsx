import type { FoodForm } from './foodSchema';
import './food.css';

interface PortionEditorProps {
  portions: FoodForm['portions'];
  onChange: (portions: FoodForm['portions']) => void;
  error?: string;
}

/**
 * The units a practitioner actually uses — "μια φέτα", "ένα φλιτζάνι" — each with its weight.
 *
 * Composition is stored per 100 g, which is the right unit for arithmetic and the wrong one for
 * building a plan: nobody prescribes 43 g of bread. Portions are what turn one into the other.
 *
 * Exactly one may be the default. Two would leave the plan builder picking arbitrarily between
 * them, so choosing one here clears the others rather than letting an invalid state be typed.
 */
export function PortionEditor({ portions, onChange, error }: PortionEditorProps) {
  function update(index: number, patch: Partial<FoodForm['portions'][number]>) {
    onChange(portions.map((portion, i) => (i === index ? { ...portion, ...patch } : portion)));
  }

  function chooseDefault(index: number) {
    onChange(portions.map((portion, i) => ({ ...portion, isDefault: i === index })));
  }

  return (
    <fieldset className="portions">
      <legend className="portions__legend">Μερίδες</legend>
      <p className="portions__hint">
        Προαιρετικές. Η σύσταση καταχωρείται ανά 100 γραμμάρια· οι μερίδες είναι οι μονάδες που
        χρησιμοποιείτε στα πλάνα.
      </p>

      {portions.length === 0 ? (
        <p className="portions__empty">Δεν έχουν οριστεί μερίδες.</p>
      ) : (
        <ol className="portions__list">
          {portions.map((portion, index) => (
            <li className="portions__row" key={index}>
              <div className="field">
                <label className="field__label" htmlFor={`portion-label-${index}`}>
                  Ονομασία
                </label>
                <input
                  id={`portion-label-${index}`}
                  className="field__input"
                  value={portion.label}
                  placeholder="π.χ. μια φέτα"
                  onChange={(event) => update(index, { label: event.target.value })}
                />
              </div>

              <div className="field">
                <label className="field__label" htmlFor={`portion-grams-${index}`}>
                  Γραμμάρια
                </label>
                <input
                  id={`portion-grams-${index}`}
                  className="field__input"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={Number.isFinite(portion.grams) ? portion.grams : ''}
                  onChange={(event) => update(index, { grams: Number(event.target.value) })}
                />
              </div>

              {/* A radio group, because "default" is a property of the set rather than of a row. */}
              <div className="portions__default">
                <input
                  type="radio"
                  name="default-portion"
                  id={`portion-default-${index}`}
                  checked={portion.isDefault}
                  onChange={() => chooseDefault(index)}
                />
                <label htmlFor={`portion-default-${index}`}>Προεπιλογή</label>
              </div>

              <button
                type="button"
                className="button button--link portions__remove"
                onClick={() => onChange(portions.filter((_, i) => i !== index))}
              >
                Αφαίρεση
                <span className="visually-hidden"> μερίδας {portion.label || index + 1}</span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        className="button button--secondary portions__add"
        onClick={() =>
          onChange([
            ...portions,
            // The first portion added is the default, because a lone non-default portion is a
            // state nobody means to create.
            { label: '', grams: 100, isDefault: portions.length === 0 },
          ])
        }
      >
        Προσθήκη μερίδας
      </button>
    </fieldset>
  );
}
