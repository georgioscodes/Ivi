import { useEffect, useState } from 'react';

import { messageFor } from '@/api/messages';
import { strings } from '@/strings';
import { useUpdateNotes } from './planMutations';
import './plan.css';

/** Mirrors `PlanNotesRequest`. The server's message is in English; this one is not. */
const MAX_LENGTH = 4000;

/**
 * The plan's notes — instructions, substitutions, what to do on a day the client eats out.
 *
 * Placed after the days for the same reason the export prints them there: they are what the food
 * is qualified by, and they read as an afterword rather than a preamble. The two documents keep
 * the same order on purpose.
 *
 * Saved explicitly, unlike every other edit in the builder. The rest of the plan commits as you
 * go because each change is a discrete act — a quantity, a food, an order. Prose is not: a
 * half-typed sentence auto-saving into the document a client receives is not a saved draft, it is
 * a published mistake.
 */
export function PlanNotes({ planId, notes }: { planId: number; notes: string | null }) {
  const update = useUpdateNotes(planId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes ?? '');

  // A plan replaced from a mutation response elsewhere on the page must not overwrite what the
  // practitioner is part-way through typing, so the draft only re-syncs while the editor is shut.
  useEffect(() => {
    if (!editing) {
      setDraft(notes ?? '');
    }
  }, [notes, editing]);

  function close() {
    setEditing(false);
    update.reset();
  }

  if (!editing) {
    return (
      <section className="notes" aria-labelledby="notes-heading">
        <div className="notes__header">
          <h2 className="section-title" id="notes-heading">
            Σημειώσεις
          </h2>
          <button type="button" className="button button--secondary" onClick={() => setEditing(true)}>
            {notes ? strings.common.edit : 'Προσθήκη σημειώσεων'}
          </button>
        </div>

        {notes ? (
          <p className="notes__body">{notes}</p>
        ) : (
          <p className="notes__empty">
            Δεν έχουν καταχωρηθεί σημειώσεις. Ό,τι γράψετε εδώ τυπώνεται στο PDF που λαμβάνει ο
            πελάτης.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="notes" aria-labelledby="notes-heading">
      <h2 className="section-title" id="notes-heading">
        Σημειώσεις
      </h2>

      <p className="notes__hint" id="notes-hint">
        Οδηγίες, εναλλακτικές και ό,τι άλλο συνοδεύει το πλάνο. Τυπώνονται στο PDF που λαμβάνει ο
        πελάτης, στο τέλος του εγγράφου. Έως {MAX_LENGTH} χαρακτήρες.
      </p>

      {update.error ? (
        <p className="form-error" role="alert">
          {messageFor(update.error)}
        </p>
      ) : null}

      <textarea
        className="notes__input"
        aria-label="Σημειώσεις πλάνου"
        aria-describedby="notes-hint"
        rows={8}
        maxLength={MAX_LENGTH}
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />

      {/* Shown only as the limit comes into view. A counter on an empty field is noise; a field
          that silently stops accepting characters is worse. */}
      {draft.length > MAX_LENGTH - 400 ? (
        <p className="notes__count" role="status">
          {draft.length} από {MAX_LENGTH} χαρακτήρες
        </p>
      ) : null}

      <div className="notes__actions">
        <button
          type="button"
          className="button button--secondary"
          disabled={update.isPending}
          onClick={close}
        >
          {strings.common.cancel}
        </button>
        <button
          type="button"
          className="button button--primary"
          disabled={update.isPending}
          onClick={() => update.mutate(draft, { onSuccess: close })}
        >
          {update.isPending ? strings.common.saving : strings.common.save}
        </button>
      </div>
    </section>
  );
}
