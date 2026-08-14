import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Empty, ErrorState, Skeleton } from '@/components/states';
import { Pagination } from '@/components/Pagination';
import { formatDate } from '@/features/client/clientQueries';
import { formatEnergy, formatGrams, suggestionStatusLabel } from './foodLabels';
import { useFoodNames, useMySuggestions } from './foodQueries';
import './food.css';

export function SuggestionsPage() {
  const [page, setPage] = useState(0);
  const query = useMySuggestions(page);
  const foodNames = useFoodNames((query.data?.content ?? []).map((s) => s.foodId));

  return (
    <>
      <header className="food__header">
        <div>
          <h1 className="page-title">Οι προτάσεις μου</h1>
          <p className="food__subtitle">
            Διορθώσεις που προτείνατε για τον κοινό κατάλογο, με τη σειρά που υποβλήθηκαν
          </p>
        </div>
        <Link to="/food" className="button button--secondary">
          Πίσω στα τρόφιμα
        </Link>
      </header>

      {query.isPending ? <Skeleton rows={4} /> : null}
      {query.error ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}

      {query.data && query.data.content.length === 0 ? (
        <Empty
          title="Δεν έχετε υποβάλει προτάσεις."
          hint="Από την καρτέλα ενός τροφίμου μπορείτε να προτείνετε διόρθωση της προεπιλεγμένης τιμής."
        />
      ) : null}

      {query.data && query.data.content.length > 0 ? (
        <>
          <div className="table-scroll">
            <table className="table">
              <caption className="visually-hidden">Προτάσεις διόρθωσης</caption>
              <thead>
                <tr>
                  <th scope="col">Υποβλήθηκε</th>
                  <th scope="col">Τρόφιμο</th>
                  <th scope="col">Πρόταση</th>
                  <th scope="col">Τεκμηρίωση</th>
                  <th scope="col">Κατάσταση</th>
                </tr>
              </thead>
              <tbody>
                {query.data.content.map((suggestion) => (
                  <tr key={suggestion.id}>
                    <td>{formatDate(suggestion.createdAt)}</td>
                    <th scope="row">
                      {/* The id is the fallback, not the label: a lookup that has not
                          resolved yet, or a food since withdrawn, still leaves a working link. */}
                      <Link to={`/food/${suggestion.foodId}`}>
                        {foodNames.get(suggestion.foodId) ?? `#${suggestion.foodId}`}
                      </Link>
                    </th>
                    <td className="food__proposal">{describe(suggestion)}</td>
                    <td className="measurement__note">{suggestion.rationale ?? '—'}</td>
                    <td>
                      {/* Status is a word, never a colour alone — and a rejected proposal reads
                          the same way to a colour-blind practitioner as an accepted one would. */}
                      <span className={`status status--${suggestion.status.toLowerCase()}`}>
                        {suggestionStatusLabel(suggestion.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={query.data.page}
            totalPages={query.data.totalPages}
            totalElements={query.data.totalElements}
            onChange={setPage}
            busy={query.isFetching}
            noun="προτάσεις"
          />
        </>
      ) : null}
    </>
  );
}

/**
 * Only what was actually proposed.
 *
 * A suggestion may correct one figure and leave the rest null, and listing every field with
 * dashes for the untouched ones buries the single number the practitioner cared about.
 */
function describe(suggestion: {
  proposedNameEl: string | null;
  proposedEnergyKcal: number | null;
  proposedProteinG: number | null;
  proposedCarbohydrateG: number | null;
  proposedFatG: number | null;
}): string {
  const parts: string[] = [];
  if (suggestion.proposedNameEl) {
    parts.push(`ονομασία → ${suggestion.proposedNameEl}`);
  }
  if (suggestion.proposedEnergyKcal !== null) {
    parts.push(`ενέργεια → ${formatEnergy(suggestion.proposedEnergyKcal)} kcal`);
  }
  if (suggestion.proposedProteinG !== null) {
    parts.push(`πρωτεΐνη → ${formatGrams(suggestion.proposedProteinG)} g`);
  }
  if (suggestion.proposedCarbohydrateG !== null) {
    parts.push(`υδατάνθρακες → ${formatGrams(suggestion.proposedCarbohydrateG)} g`);
  }
  if (suggestion.proposedFatG !== null) {
    parts.push(`λίπος → ${formatGrams(suggestion.proposedFatG)} g`);
  }
  return parts.join(' · ') || '—';
}
