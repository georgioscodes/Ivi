import { useEffect, useState } from 'react';

/**
 * Block 0's demonstrable end: one jar serves this page and answers its API call.
 *
 * Everything here is scaffolding and gets replaced by the router in Block 2. It exists so the
 * build wiring can be proven rather than assumed — that the Vite output is on the classpath,
 * that a deep link falls back to index.html, that the fetch reaches Spring on the same origin,
 * and that Greek renders in the loaded face rather than a fallback.
 */
export function App() {
  const [health, setHealth] = useState<'checking' | 'up' | 'unreachable'>('checking');

  useEffect(() => {
    fetch('/actuator/health')
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((body: { status?: string }) => setHealth(body.status === 'UP' ? 'up' : 'unreachable'))
      .catch(() => setHealth('unreachable'));
  }, []);

  return (
    <main style={main}>
      <h1 style={{ fontSize: 'var(--text-2xl)' }}>Ivi</h1>
      <p style={{ color: 'var(--text-secondary)' }}>
        Λογισμικό διαχείρισης διαιτολογικού γραφείου
      </p>

      <p style={{ marginTop: 'var(--space-5)' }}>
        Backend:{' '}
        <strong style={{ color: statusColour[health] }}>{statusLabel[health]}</strong>
      </p>

      {/*
        A type specimen, not decoration. Tonos and dialytika are where a font with nominal
        Greek support usually falls over, and a fallback face is easy to miss by glancing.
        Block 9 asserts this in the browser instead of trusting the eye.
      */}
      <section style={specimen}>
        <p style={{ fontSize: 'var(--text-lg)' }}>Ελένη Παπαδοπούλου — πρωινό, γεύμα, δείπνο</p>
        <p>Ά Έ Ή Ί Ό Ύ Ώ ά έ ή ί ό ύ ώ ΐ ΰ ϊ ϋ Ϊ Ϋ ς</p>
        <p style={{ fontFamily: 'var(--font-mono)' }}>1.234,5 g · 2.150 kcal · 27,3 %</p>
      </section>
    </main>
  );
}

const statusLabel: Record<'checking' | 'up' | 'unreachable', string> = {
  checking: '…',
  up: 'συνδεδεμένο',
  unreachable: 'μη προσβάσιμο',
};

const statusColour: Record<'checking' | 'up' | 'unreachable', string> = {
  checking: 'var(--text-secondary)',
  up: 'var(--success)',
  unreachable: 'var(--error)',
};

const main: React.CSSProperties = {
  maxWidth: '42rem',
  margin: '0 auto',
  padding: 'var(--space-8) var(--space-5)',
};

const specimen: React.CSSProperties = {
  marginTop: 'var(--space-6)',
  padding: 'var(--space-5)',
  background: 'var(--brand-peach)',
  borderRadius: 'var(--radius-lg)',
  display: 'grid',
  gap: 'var(--space-2)',
};
