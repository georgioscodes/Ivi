import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Empty, ErrorState, Skeleton } from '@/components/states';
import { Pagination } from '@/components/Pagination';
import { formatDate } from '@/features/client/clientQueries';
import { CreatePlanForm } from './CreatePlanForm';
import { formatKcal, statusLabel } from './planLabels';
import { usePlansForClient } from './planQueries';
import './plan.css';

/** The client's plans. Creation lives here because a plan is always created for a client. */
export function PlansTab() {
  const clientId = Number(useParams().clientId);
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);

  const query = usePlansForClient(clientId, page);

  if (creating) {
    return <CreatePlanForm clientId={clientId} onDone={() => setCreating(false)} />;
  }

  return (
    <>
      <div className="plan__actions">
        <button type="button" className="button button--primary" onClick={() => setCreating(true)}>
          Νέο πλάνο
        </button>
      </div>

      {query.isPending ? <Skeleton rows={4} /> : null}
      {query.error ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}

      {query.data && query.data.content.length === 0 ? (
        <Empty
          title="Δεν υπάρχουν πλάνα για αυτόν τον πελάτη."
          hint="Δημιουργήστε το πρώτο πλάνο διατροφής."
        />
      ) : null}

      {query.data && query.data.content.length > 0 ? (
        <>
          <div className="table-scroll">
            <table className="table">
              <caption className="visually-hidden">Πλάνα διατροφής</caption>
              <thead>
                <tr>
                  <th scope="col">Πλάνο</th>
                  <th scope="col">Κατάσταση</th>
                  <th scope="col" className="numeric">Στόχος</th>
                  <th scope="col" className="numeric">Ημέρες</th>
                  <th scope="col">Ενημερώθηκε</th>
                </tr>
              </thead>
              <tbody>
                {query.data.content.map((plan) => (
                  <tr key={plan.id}>
                    <th scope="row">
                      <Link to={`/client/${clientId}/plan/${plan.id}`}>{plan.name}</Link>
                    </th>
                    <td>
                      <span className={`status status--${plan.status.toLowerCase()}`}>
                        {statusLabel(plan.status)}
                      </span>
                    </td>
                    <td className="numeric">{formatKcal(plan.targetKcal)} kcal</td>
                    <td className="numeric">{plan.dayCount}</td>
                    <td>{formatDate(plan.updatedAt)}</td>
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
            noun="πλάνα"
          />
        </>
      ) : null}
    </>
  );
}
