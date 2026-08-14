import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { Empty, ErrorState, Skeleton } from '@/components/states';
import { Pagination } from '@/components/Pagination';
import { useDebounced } from '@/components/useDebounced';
import { strings } from '@/strings';
import { displayValue, formatDate, useClients } from './clientQueries';
import './client.css';

const PAGE_SIZE = 20;

export function ClientListPage() {
  // Search and page live in the URL, so a result list can be linked, bookmarked and returned to
  // with the back button. Holding them in component state loses all three.
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? 0);
  const nameFromUrl = searchParams.get('name') ?? '';

  // The input is immediate; the query it drives is not.
  const [typed, setTyped] = useState(nameFromUrl);
  const name = useDebounced(typed);

  const query = useClients({ name: name || undefined, page, size: PAGE_SIZE });

  function search(value: string) {
    setTyped(value);
    // A new search starts at the first page. Staying on page three of the previous results shows
    // an empty table for a term that has plenty of matches.
    setSearchParams(value ? { name: value } : {}, { replace: true });
  }

  function goToPage(next: number) {
    const params: Record<string, string> = { page: String(next) };
    if (name) {
      params.name = name;
    }
    setSearchParams(params);
  }

  return (
    <>
      <header className="client-list__header">
        <h1 className="page-title">Πελάτες</h1>
        <Link to="/client/new" className="button button--primary">
          Νέος πελάτης
        </Link>
      </header>

      <div className="client-list__search">
        <label className="visually-hidden" htmlFor="client-search">
          {strings.common.search}
        </label>
        <input
          id="client-search"
          type="search"
          className="field__input"
          placeholder="Αναζήτηση με όνομα…"
          value={typed}
          onChange={(event) => search(event.target.value)}
        />
      </div>

      {query.isPending ? <Skeleton rows={6} /> : null}

      {query.error ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}

      {query.data && query.data.content.length === 0 ? (
        <Empty
          title={name ? strings.empty.noResults : 'Δεν υπάρχουν ακόμη πελάτες.'}
          hint={name ? strings.empty.noResultsHint : 'Ξεκινήστε προσθέτοντας τον πρώτο σας πελάτη.'}
          action={
            name ? null : (
              <Link to="/client/new" className="button button--primary">
                Νέος πελάτης
              </Link>
            )
          }
        />
      ) : null}

      {query.data && query.data.content.length > 0 ? (
        <>
          {/* Wrapped so a narrow screen scrolls the table rather than the page. */}
          <div className="table-scroll">
            <table className="table">
              <caption className="visually-hidden">Λίστα πελατών</caption>
              <thead>
                <tr>
                  <th scope="col">Ονοματεπώνυμο</th>
                  <th scope="col">Email</th>
                  <th scope="col">Τηλέφωνο</th>
                  <th scope="col">Ημ. γέννησης</th>
                </tr>
              </thead>
              <tbody>
                {query.data.content.map((client) => (
                  <tr key={client.id}>
                    <th scope="row">
                      <Link to={`/client/${client.id}`}>{client.fullName}</Link>
                    </th>
                    <td>{displayValue(client.email)}</td>
                    <td>{displayValue(client.phone)}</td>
                    <td>{formatDate(client.dateOfBirth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={query.data.page}
            totalPages={query.data.totalPages}
            totalElements={query.data.totalElements}
            onChange={goToPage}
            busy={query.isFetching}
            noun="πελάτες"
          />
        </>
      ) : null}
    </>
  );
}
