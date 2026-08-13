import { Empty, ErrorState, Loading } from '@/components/states';
import { useSession, useSessionExpiryHandler } from '@/session/session';
import { strings } from '@/strings';

/**
 * Scaffolding, replaced by the router in Block 2.
 *
 * What it demonstrates is the API boundary end to end: the session is resolved from the server
 * rather than assumed, a 401 on first load is treated as "nobody is signed in" rather than as a
 * failure, and a real failure is distinguishable from both.
 */
export function App() {
  useSessionExpiryHandler();

  const { practitioner, isLoading, error } = useSession();

  return (
    <main style={main}>
      <h1 style={{ fontSize: 'var(--text-2xl)' }}>{strings.app.name}</h1>
      <p style={{ color: 'var(--text-secondary)' }}>{strings.app.tagline}</p>

      <section style={{ marginTop: 'var(--space-6)' }}>
        {isLoading ? <Loading /> : null}

        {/* A failed session check is not the same as not being signed in, and showing a login
            form for a server fault sends the practitioner to re-enter a password that was never
            the problem. */}
        {!isLoading && error ? (
          <ErrorState error={error} onRetry={() => window.location.reload()} />
        ) : null}

        {!isLoading && !error && !practitioner ? (
          <Empty title="Δεν έχετε συνδεθεί." hint="Η οθόνη σύνδεσης έρχεται στο επόμενο βήμα." />
        ) : null}

        {practitioner ? (
          <p>
            Συνδεδεμένος ως <strong>{practitioner.displayName}</strong>
            {practitioner.practiceName ? ` · ${practitioner.practiceName}` : null}
          </p>
        ) : null}
      </section>
    </main>
  );
}

const main: React.CSSProperties = {
  maxWidth: '42rem',
  margin: '0 auto',
  padding: 'var(--space-8) var(--space-5)',
};
