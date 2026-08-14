import { useState } from 'react';

import { messageFor } from '@/api/messages';
import type { FoodResponse, FoodSuggestionRequest } from '@/api/types';
import { TextField } from '@/components/form/TextField';
import { strings } from '@/strings';
import { useSuggestChange } from './foodQueries';
import './food.css';

interface SuggestionFormProps {
  food: FoodResponse;
  onDone: () => void;
}

/**
 * Proposes a correction to the shared catalogue.
 *
 * Distinct from an override in a way the copy has to keep straight: an override says "this value
 * is wrong *for my practice*", a suggestion says "this value is wrong *for everyone*". The first
 * takes effect immediately and privately; the second changes nothing until somebody reviews it.
 *
 * Every field is optional server-side, and the form keeps it that way: a suggestion that only
 * corrects the protein figure should not require restating the other three. Fields left blank are
 * omitted rather than sent as the current value, so the proposal says exactly what it means.
 */
export function SuggestionForm({ food, onDone }: SuggestionFormProps) {
  /**
   * The *catalogue* food's id, which is not the same as this row's once an override exists.
   *
   * `POST /food/{id}/suggestion` resolves the id against the shared catalogue only, so posting an
   * override's own id is rejected outright — "suggestions apply to catalogue foods only". Which
   * means the practitioner most likely to spot a wrong default, the one who already corrected it
   * for themselves, was the one who could not report it.
   */
  const suggest = useSuggestChange(food.overridesFoodId ?? food.id);

  const [proposal, setProposal] = useState({
    nameEl: '',
    energyKcal: '',
    proteinG: '',
    carbohydrateG: '',
    fatG: '',
    rationale: '',
  });

  const number = (raw: string) => (raw.trim() === '' ? undefined : Number(raw));
  const invalid = (raw: string) => raw.trim() !== '' && !Number.isFinite(Number(raw));

  const anyProposed =
    proposal.nameEl.trim() !== '' ||
    [proposal.energyKcal, proposal.proteinG, proposal.carbohydrateG, proposal.fatG].some(
      (raw) => raw.trim() !== '',
    );
  const anyInvalid = [
    proposal.energyKcal,
    proposal.proteinG,
    proposal.carbohydrateG,
    proposal.fatG,
  ].some(invalid);
  const rationaleTooLong = proposal.rationale.length > 2000;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!anyProposed || anyInvalid || rationaleTooLong) {
      return;
    }

    const body: FoodSuggestionRequest = {
      proposedNameEl: proposal.nameEl.trim() || undefined,
      proposedEnergyKcal: number(proposal.energyKcal),
      proposedProteinG: number(proposal.proteinG),
      proposedCarbohydrateG: number(proposal.carbohydrateG),
      proposedFatG: number(proposal.fatG),
      rationale: proposal.rationale.trim() || undefined,
    };

    suggest.mutate(body, { onSuccess: onDone });
  }

  const field = (key: keyof typeof proposal) => ({
    value: proposal[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setProposal((current) => ({ ...current, [key]: event.target.value })),
  });

  return (
    <form className="suggestion-form" onSubmit={submit} noValidate>
      <p className="food__suggest-intro">
        Συμπληρώστε μόνο όσα θεωρείτε λανθασμένα. Τα κενά πεδία δεν προτείνονται προς αλλαγή.
      </p>

      {suggest.error ? (
        <p className="form-error" role="alert">
          {messageFor(suggest.error)}
        </p>
      ) : null}

      <TextField
        label="Προτεινόμενη ονομασία"
        // The current value as a placeholder, not as a default — typing it in unchanged would
        // propose a change that is not one.
        placeholder={food.nameEl}
        {...field('nameEl')}
      />

      <div className="food-form__row">
        <TextField
          label="Ενέργεια (kcal)"
          type="number"
          step="1"
          min="0"
          placeholder={String(food.energyKcal)}
          error={invalid(proposal.energyKcal) ? 'Μη έγκυρη τιμή' : undefined}
          {...field('energyKcal')}
        />
        <TextField
          label="Πρωτεΐνη (g)"
          type="number"
          step="0.1"
          min="0"
          placeholder={String(food.proteinG)}
          error={invalid(proposal.proteinG) ? 'Μη έγκυρη τιμή' : undefined}
          {...field('proteinG')}
        />
        <TextField
          label="Υδατάνθρακες (g)"
          type="number"
          step="0.1"
          min="0"
          placeholder={String(food.carbohydrateG)}
          error={invalid(proposal.carbohydrateG) ? 'Μη έγκυρη τιμή' : undefined}
          {...field('carbohydrateG')}
        />
        <TextField
          label="Λίπος (g)"
          type="number"
          step="0.1"
          min="0"
          placeholder={String(food.fatG)}
          error={invalid(proposal.fatG) ? 'Μη έγκυρη τιμή' : undefined}
          {...field('fatG')}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="rationale">
          Τεκμηρίωση
        </label>
        <textarea
          id="rationale"
          className="field__input"
          rows={3}
          placeholder="Πηγή ή λόγος της διόρθωσης"
          value={proposal.rationale}
          onChange={(event) =>
            setProposal((current) => ({ ...current, rationale: event.target.value }))
          }
          aria-describedby="rationale-count"
          aria-invalid={rationaleTooLong || undefined}
        />
        <p className={`field__hint${rationaleTooLong ? ' field__error' : ''}`} id="rationale-count">
          {proposal.rationale.length} / 2000
        </p>
      </div>

      <div className="food-form__actions">
        <button type="button" className="button button--secondary" onClick={onDone}>
          {strings.common.cancel}
        </button>
        <button
          type="submit"
          className="button button--primary"
          disabled={!anyProposed || anyInvalid || rationaleTooLong || suggest.isPending}
        >
          {suggest.isPending ? strings.common.saving : 'Υποβολή πρότασης'}
        </button>
      </div>
    </form>
  );
}
