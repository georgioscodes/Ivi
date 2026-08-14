import { Link, useParams } from 'react-router-dom';

import { ErrorState, Loading } from '@/components/states';
import { useClient } from '@/features/client/clientQueries';
import { PlanView } from './PlanView';
import { formatGrams, formatKcal, statusLabel } from './planLabels';
import { usePlan } from './planQueries';
import './plan.css';

/**
 * The plan builder's own route: `/client/:clientId/plan/:planId`.
 *
 * A full page rather than a tab panel, because building a plan is the longest thing a
 * practitioner does in this application and it needs the width.
 */
export function PlanPage() {
  const params = useParams();
  const clientId = Number(params.clientId);
  const planId = Number(params.planId);

  const plan = usePlan(planId);
  const client = useClient(clientId);

  if (plan.isPending) {
    return <Loading />;
  }
  if (plan.error) {
    return <ErrorState error={plan.error} onRetry={() => void plan.refetch()} />;
  }

  const data = plan.data;

  return (
    <>
      <nav className="plan__breadcrumb" aria-label="Διαδρομή">
        <Link to={`/client/${clientId}/plans`}>
          {client.data ? client.data.fullName : 'Πελάτης'}
        </Link>
        <span aria-hidden="true"> · </span>
        <span>Πλάνα</span>
      </nav>

      <header className="plan__header">
        <div>
          <h1 className="page-title">{data.name}</h1>
          <p className="plan__meta">
            <span className={`status status--${data.status.toLowerCase()}`}>
              {statusLabel(data.status)}
            </span>
            <span aria-hidden="true"> · </span>
            {data.days.length} {data.days.length === 1 ? 'ημέρα' : 'ημέρες'}
          </p>
        </div>
      </header>

      <section className="plan__targets" aria-labelledby="targets-heading">
        <h2 className="section-title" id="targets-heading">
          Ημερήσιοι στόχοι
        </h2>
        <dl className="plan__target-grid">
          <div>
            <dt>Ενέργεια</dt>
            <dd>{formatKcal(data.targets.energyKcal)} kcal</dd>
          </div>
          <div>
            <dt>Πρωτεΐνη</dt>
            <dd>{formatGrams(data.targets.proteinG)} g</dd>
          </div>
          <div>
            <dt>Υδατάνθρακες</dt>
            <dd>{formatGrams(data.targets.carbohydrateG)} g</dd>
          </div>
          <div>
            <dt>Λίπος</dt>
            <dd>{formatGrams(data.targets.fatG)} g</dd>
          </div>
        </dl>

        {/* The average across every day, from the server. For a plan whose days differ this is
            the figure that says whether the week works, which no single day does. */}
        <dl className="plan__target-grid plan__target-grid--average">
          <div>
            <dt>Μέσος όρος ημέρας</dt>
            <dd>{formatKcal(data.dailyAverage.energyKcal)} kcal</dd>
          </div>
          <div>
            <dt>Πρωτεΐνη</dt>
            <dd>{formatGrams(data.dailyAverage.proteinG)} g</dd>
          </div>
          <div>
            <dt>Υδατάνθρακες</dt>
            <dd>{formatGrams(data.dailyAverage.carbohydrateG)} g</dd>
          </div>
          <div>
            <dt>Λίπος</dt>
            <dd>{formatGrams(data.dailyAverage.fatG)} g</dd>
          </div>
        </dl>
      </section>

      <PlanView plan={data} />
    </>
  );
}
