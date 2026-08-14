import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import type { JournalEntryResponse } from '@/api/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Pagination } from '@/components/Pagination';
import { Empty, ErrorState, Skeleton } from '@/components/states';
import { useDebounced } from '@/components/useDebounced';
import { strings } from '@/strings';
import { JournalEntryForm } from './JournalEntryForm';
import { formatEntryDate, weekdayOf } from './journalDates';
import { useDeleteJournalEntry, useJournalEntries } from './journalQueries';
import './journal.css';

/**
 * The consultation journal for one client.
 *
 * These are clinical notes about a named person — the most sensitive free text the application
 * holds — and **none of it is ever shown to the client**. That is the sharp difference from the
 * notes on a plan, which exist precisely to be printed and handed over.
 */
export function JournalTab() {
  const clientId = Number(useParams().clientId);

  const [term, setTerm] = useState('');
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<JournalEntryResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<JournalEntryResponse | null>(null);

  /*
    Debounced, and here the usual reason is the lesser one. Every list read writes a row to the
    audit log — `recordClientRead("JOURNAL", …)` — because reading someone's clinical notes is an
    access that has to be recorded. Querying per keystroke would put eight rows in that log for one
    word typed, burying the accesses that actually happened in a trail of half-typed prefixes.
  */
  const search = useDebounced(term);
  const query = useJournalEntries(clientId, search, page);
  const remove = useDeleteJournalEntry(clientId);

  // A narrowed search has fewer pages than the one before it, and page 3 of a 1-page result is
  // empty — which reads as "no matches" when there are plenty.
  useEffect(() => {
    setPage(0);
  }, [search]);

  if (creating || editing) {
    return (
      <JournalEntryForm
        clientId={clientId}
        entry={editing}
        onDone={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
    );
  }

  const entries = query.data?.content ?? [];
  const searching = search.trim() !== '';

  return (
    <>
      <div className="journal__toolbar">
        <div className="journal__search">
          <label className="visually-hidden" htmlFor="journal-search">
            Αναζήτηση στις καταχωρήσεις
          </label>
          <input
            id="journal-search"
            type="search"
            className="field__input"
            placeholder="Αναζήτηση σε τίτλο και κείμενο…"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
          />
        </div>
        <button type="button" className="button button--primary" onClick={() => setCreating(true)}>
          Νέα καταχώρηση
        </button>
      </div>

      {query.isPending ? <Skeleton rows={3} /> : null}
      {query.error ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}

      {query.data && entries.length === 0 ? (
        searching ? (
          <Empty
            title="Καμία καταχώρηση δεν ταιριάζει με την αναζήτηση."
            hint="Δοκιμάστε μια άλλη λέξη ή καθαρίστε το πεδίο."
          />
        ) : (
          <Empty
            title="Δεν υπάρχουν καταχωρήσεις για αυτόν τον πελάτη."
            hint="Καταγράψτε την πρώτη συνεδρία."
          />
        )
      ) : null}

      {entries.length > 0 ? (
        <>
          {/*
            An ordered list, not a table. An entry is a piece of prose of no fixed length, and the
            date it belongs to is its heading rather than a column beside it.
          */}
          <ol className="journal__list" aria-busy={query.isFetching || undefined}>
            {entries.map((entry) => (
              <li className="entry" key={entry.id}>
                <header className="entry__header">
                  <div>
                    <h3 className="entry__date">
                      {formatEntryDate(entry.entryDate)}
                      <span className="entry__weekday">{weekdayOf(entry.entryDate)}</span>
                    </h3>
                    {entry.title ? <p className="entry__title">{entry.title}</p> : null}
                  </div>

                  <div className="entry__actions">
                    <button
                      type="button"
                      className="button button--link entry__action"
                      onClick={() => setEditing(entry)}
                    >
                      {strings.common.edit}
                      {/*
                        Reads as one phrase — "Επεξεργασία καταχώρησης με ημερομηνία 11
                        Αυγούστου 2026". Genitive after the verb, and "με ημερομηνία" so the date
                        itself needs no inflection.
                      */}
                      <span className="visually-hidden">
                        {' '}
                        καταχώρησης με ημερομηνία {formatEntryDate(entry.entryDate)}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="button button--link entry__action"
                      onClick={() => setRemoving(entry)}
                    >
                      {strings.common.delete}
                      <span className="visually-hidden">
                        {' '}
                        καταχώρησης με ημερομηνία {formatEntryDate(entry.entryDate)}
                      </span>
                    </button>
                  </div>
                </header>

                {/* pre-wrap: a practitioner's paragraph breaks and lists are the structure of the
                    note, and flattening them changes what it says. */}
                <p className="entry__content">{entry.content}</p>

                {/*
                  Shown only when it differs from creation. A journal is a clinical record, and a
                  reader deserves to know an entry was changed after it was first written.
                */}
                {entry.updatedAt && entry.updatedAt !== entry.createdAt ? (
                  <p className="entry__amended">Τροποποιήθηκε</p>
                ) : null}
              </li>
            ))}
          </ol>

          {query.data ? (
            <Pagination
              page={query.data.page}
              totalPages={query.data.totalPages}
              totalElements={query.data.totalElements}
              onChange={setPage}
              busy={query.isFetching}
              noun="καταχωρήσεις"
            />
          ) : null}
        </>
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        destructive
        busy={remove.isPending}
        title="Διαγραφή καταχώρησης"
        /*
          "με ημερομηνία X" rather than "της X": a cardinal date after a genitive article reads
          wrong in Greek — "της 3 Αυγούστου" wants an ordinal, "της 3ης". The same trap as the
          day label in the plan builder, and the same escape: phrase it so the value needs no
          inflection at all.
        */
        body={`Η καταχώρηση με ημερομηνία ${removing ? formatEntryDate(removing.entryDate) : ''} θα διαγραφεί οριστικά. Η ενέργεια δεν αναιρείται.`}
        confirmLabel={strings.common.delete}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) {
            remove.mutate(removing.id, { onSettled: () => setRemoving(null) });
          }
        }}
      />
    </>
  );
}
