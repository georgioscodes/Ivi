import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorState, Loading } from '@/components/states';
import { messageFor } from '@/api/messages';
import { usePageTitle } from '@/app/usePageTitle';
import { strings } from '@/strings';
import { displayValue, formatDate, useClient, useDeleteClient } from './clientQueries';
import './client.css';

const TABS = [
  { to: '', label: 'Επισκόπηση', end: true },
  { to: 'measurements', label: 'Μετρήσεις' },
  { to: 'targets', label: 'Στόχοι' },
  { to: 'plans', label: 'Πλάνα' },
  { to: 'journal', label: 'Ημερολόγιο' },
];

export function ClientDetailPage() {
  usePageTitle('Καρτέλα πελάτη');
  const params = useParams();
  const id = Number(params.clientId);
  const navigate = useNavigate();

  const query = useClient(id);
  const remove = useDeleteClient();
  const [confirming, setConfirming] = useState(false);

  if (query.isPending) {
    return <Loading />;
  }

  if (query.error) {
    // A client belonging to another practitioner arrives here as a 404, never a 403 — a 403
    // would confirm the record exists. So "not found" is the honest thing to show either way.
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  const client = query.data;

  return (
    <>
      <header className="client-detail__header">
        <div>
          <h1 className="page-title">{client.fullName}</h1>
          <p className="client-detail__meta">
            Πελάτης από {formatDate(client.createdAt)}
          </p>
        </div>

        <div className="client-detail__actions">
          <Link to={`/client/${id}/edit`} className="button button--secondary">
            {strings.common.edit}
          </Link>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setConfirming(true)}
          >
            {strings.common.delete}
          </button>
        </div>
      </header>

      {remove.error ? (
        <p className="form-error" role="alert">
          {messageFor(remove.error)}
        </p>
      ) : null}

      {/*
        Links rather than ARIA tabs. Each panel is a route, so the URL is the state: a reload, a
        bookmark and the back button all work. Marking them role="tab" would promise keyboard
        semantics that routed links do not have.
      */}
      <nav className="tabs" aria-label="Καρτέλα πελάτη">
        {TABS.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `tabs__tab${isActive ? ' tabs__tab--active' : ''}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <div className="tabs__panel">
        <Outlet context={client} />
      </div>

      <ConfirmDialog
        open={confirming}
        destructive
        busy={remove.isPending}
        title="Διαγραφή πελάτη"
        body={`Ο πελάτης ${client.fullName} και όλα τα δεδομένα του — μετρήσεις, πλάνα, ημερολόγιο — θα διαγραφούν οριστικά. Η ενέργεια δεν αναιρείται.`}
        confirmLabel={strings.common.delete}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          remove.mutate(id, {
            onSuccess: () => navigate('/', { replace: true }),
            onError: () => setConfirming(false),
          })
        }
      />
    </>
  );
}

/** The overview tab. */
export function ClientOverviewTab() {
  const params = useParams();
  const query = useClient(Number(params.clientId));

  if (!query.data) {
    return null;
  }

  const client = query.data;

  return (
    <dl className="detail-grid">
      <div>
        <dt>Email</dt>
        <dd>{displayValue(client.email)}</dd>
      </div>
      <div>
        <dt>Τηλέφωνο</dt>
        <dd>{displayValue(client.phone)}</dd>
      </div>
      <div>
        <dt>Ημερομηνία γέννησης</dt>
        <dd>{formatDate(client.dateOfBirth)}</dd>
      </div>
      <div>
        <dt>Τελευταία ενημέρωση</dt>
        <dd>{formatDate(client.updatedAt)}</dd>
      </div>
      <div className="detail-grid__wide">
        <dt>Στόχος</dt>
        <dd>{displayValue(client.goal)}</dd>
      </div>
      <div className="detail-grid__wide">
        <dt>Σημειώσεις</dt>
        {/* pre-wrap: a practitioner's notes are written with line breaks that carry meaning. */}
        <dd className="detail-grid__notes">{displayValue(client.notes)}</dd>
      </div>
    </dl>
  );
}
