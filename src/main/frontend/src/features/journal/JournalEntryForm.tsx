import { useState } from 'react';

import { messageFor } from '@/api/messages';
import type { IsoDate, JournalEntryResponse } from '@/api/types';
import { TextField } from '@/components/form/TextField';
import { strings } from '@/strings';
import { formatEntryDate, today, weekdayOf } from './journalDates';
import { useCreateJournalEntry, useUpdateJournalEntry } from './journalQueries';
import './journal.css';

/** Mirrors the server's constraints, in Greek. `content` is @NotBlank, `title` @Size(max = 200). */
const TITLE_MAX = 200;

const DATE_HINT = 'Η ημέρα που έγινε η συνεδρία, όχι η ημέρα καταγραφής.';

function dateHint(value: string): string {
  const spelled = formatEntryDate(value);
  return spelled ? `${weekdayOf(value)}, ${spelled}. ${DATE_HINT}` : DATE_HINT;
}

/**
 * Writing up a consultation, and amending one.
 *
 * One form for both, because an amend is the same act as writing it in the first place — the same
 * three fields, the same rules. Splitting them would mean two places to keep the validation
 * honest.
 */
export function JournalEntryForm({
  clientId,
  entry,
  onDone,
}: {
  clientId: number;
  /** Null creates. Otherwise the entry being amended. */
  entry: JournalEntryResponse | null;
  onDone: () => void;
}) {
  const create = useCreateJournalEntry(clientId);
  const update = useUpdateJournalEntry(clientId);
  const saving = create.isPending || update.isPending;
  const error = create.error ?? update.error;

  const [form, setForm] = useState({
    // Defaulted, not fixed: sessions are frequently written up days later, and the date that
    // matters clinically is when the consultation happened.
    entryDate: entry ? entry.entryDate : today(),
    title: entry?.title ?? '',
    content: entry?.content ?? '',
  });

  // Shown after a submit attempt rather than while typing, so the form does not scold someone
  // for a field they have not finished.
  const [submitted, setSubmitted] = useState(false);

  const contentError =
    submitted && form.content.trim() === '' ? 'Το κείμενο δεν μπορεί να είναι κενό.' : undefined;
  const dateError =
    submitted && form.entryDate > today()
      ? 'Η ημερομηνία δεν μπορεί να είναι μελλοντική.'
      : undefined;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);

    if (form.content.trim() === '' || form.entryDate > today()) {
      return;
    }

    const body = {
      entryDate: form.entryDate as IsoDate,
      title: form.title.trim() === '' ? undefined : form.title.trim(),
      content: form.content.trim(),
    };

    if (entry) {
      update.mutate({ id: entry.id, body }, { onSuccess: onDone });
    } else {
      create.mutate({ clientId, ...body }, { onSuccess: onDone });
    }
  }

  return (
    <form className="journal-form" onSubmit={submit} noValidate>
      <h2 className="section-title">{entry ? 'Επεξεργασία καταχώρησης' : 'Νέα καταχώρηση'}</h2>

      {error ? (
        <p className="form-error" role="alert">
          {messageFor(error)}
        </p>
      ) : null}

      <div className="journal-form__row">
        <TextField
          label="Ημερομηνία συνεδρίας"
          type="date"
          required
          // The server rejects a future date; saying so here saves the round trip.
          max={today()}
          /*
            The hint echoes the date back in Greek because a native date input is rendered in the
            *browser's* locale, not the page's — on an en-US browser this field reads 08/07/2026,
            which is either July or August depending on where the reader learned to read dates.
            Nothing in the page can change that rendering, so the unambiguous form is spelled out
            underneath instead.
          */
          hint={dateHint(form.entryDate)}
          error={dateError}
          value={form.entryDate}
          onChange={(e) => setForm((f) => ({ ...f, entryDate: e.target.value as IsoDate }))}
        />
        <TextField
          label="Τίτλος"
          maxLength={TITLE_MAX}
          hint="Προαιρετικός."
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="journal-content">
          Σημειώσεις συνεδρίας
          <span className="field__required" aria-hidden="true"> *</span>
        </label>
        <textarea
          id="journal-content"
          className={`journal-form__content${contentError ? ' field__input--invalid' : ''}`}
          rows={12}
          autoFocus
          aria-invalid={contentError ? true : undefined}
          aria-describedby={contentError ? 'journal-content-error' : undefined}
          value={form.content}
          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
        />
        {contentError ? (
          <p className="field__error" id="journal-content-error" role="alert">
            {contentError}
          </p>
        ) : null}
      </div>

      <div className="journal-form__actions">
        <button
          type="button"
          className="button button--secondary"
          disabled={saving}
          onClick={onDone}
        >
          {strings.common.cancel}
        </button>
        <button type="submit" className="button button--primary" disabled={saving}>
          {saving ? strings.common.saving : strings.common.save}
        </button>
      </div>
    </form>
  );
}
