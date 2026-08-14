import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { messageFor } from '@/api/messages';
import { TextField } from '@/components/form/TextField';
import { strings } from '@/strings';
import { useCreatePlan } from './planQueries';
import './plan.css';

/**
 * A new plan needs a name, a length, and the four targets it will be measured against.
 *
 * The targets are entered here rather than pulled from the Στόχοι tab. The calculator produces a
 * recommendation; a plan records what the practitioner actually decided, and those are allowed to
 * differ. Carrying values across from the calculator is a genuine convenience and belongs with
 * the rest of the plan builder work, not here — see the note in ui-build-tasks.md.
 */
export function CreatePlanForm({ clientId, onDone }: { clientId: number; onDone: () => void }) {
  const navigate = useNavigate();
  const create = useCreatePlan();

  const [form, setForm] = useState({
    name: 'Πλάνο διατροφής',
    dayCount: '7',
    targetKcal: '',
    targetProteinG: '',
    targetCarbohydrateG: '',
    targetFatG: '',
  });

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const number = (raw: string) => Number(raw);
  const filled = (raw: string) => raw.trim() !== '' && Number.isFinite(Number(raw));

  const ready =
    form.name.trim() !== '' &&
    filled(form.dayCount) &&
    filled(form.targetKcal) &&
    filled(form.targetProteinG) &&
    filled(form.targetCarbohydrateG) &&
    filled(form.targetFatG);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) {
      return;
    }

    create.mutate(
      {
        clientId,
        name: form.name.trim(),
        dayCount: number(form.dayCount),
        targetKcal: number(form.targetKcal),
        targetProteinG: number(form.targetProteinG),
        targetCarbohydrateG: number(form.targetCarbohydrateG),
        targetFatG: number(form.targetFatG),
      },
      { onSuccess: (plan) => navigate(`/client/${clientId}/plan/${plan.id}`) },
    );
  }

  return (
    <form className="plan-form" onSubmit={submit} noValidate>
      <h2 className="section-title">Νέο πλάνο</h2>

      {create.error ? (
        <p className="form-error" role="alert">
          {messageFor(create.error)}
        </p>
      ) : null}

      <div className="plan-form__row">
        <TextField label="Ονομασία" required autoFocus value={form.name} onChange={set('name')} />
        <TextField
          label="Ημέρες"
          type="number"
          min="1"
          max="31"
          step="1"
          required
          hint="Έως 31 ημέρες"
          value={form.dayCount}
          onChange={set('dayCount')}
        />
      </div>

      <h3 className="plan-form__heading">Ημερήσιοι στόχοι</h3>
      <p className="plan-form__hint">
        Οι τιμές που θα συγκρίνεται το πλάνο. Μπορείτε να τις υπολογίσετε στην καρτέλα «Στόχοι».
      </p>

      <div className="plan-form__row">
        <TextField
          label="Ενέργεια (kcal)"
          type="number"
          min="400"
          step="1"
          required
          value={form.targetKcal}
          onChange={set('targetKcal')}
        />
        <TextField
          label="Πρωτεΐνη (g)"
          type="number"
          min="0"
          step="0.1"
          required
          value={form.targetProteinG}
          onChange={set('targetProteinG')}
        />
        <TextField
          label="Υδατάνθρακες (g)"
          type="number"
          min="0"
          step="0.1"
          required
          value={form.targetCarbohydrateG}
          onChange={set('targetCarbohydrateG')}
        />
        <TextField
          label="Λίπος (g)"
          type="number"
          min="0"
          step="0.1"
          required
          value={form.targetFatG}
          onChange={set('targetFatG')}
        />
      </div>

      <div className="plan-form__actions">
        <button type="button" className="button button--secondary" onClick={onDone}>
          {strings.common.cancel}
        </button>
        <button
          type="submit"
          className="button button--primary"
          disabled={!ready || create.isPending}
        >
          {create.isPending ? strings.common.saving : 'Δημιουργία'}
        </button>
      </div>
    </form>
  );
}
