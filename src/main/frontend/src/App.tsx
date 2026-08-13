import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';

import { AppShell } from '@/app/AppShell';
import { GuestOnlyRoute, ProtectedRoute } from '@/app/ProtectedRoute';
import { Empty } from '@/components/states';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { useSessionExpiryHandler } from '@/session/session';
import { strings } from '@/strings';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <GuestOnlyRoute>
              <LoginPage />
            </GuestOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <GuestOnlyRoute>
              <RegisterPage />
            </GuestOnlyRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute>
              <SessionAwareShell />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Home />} />

          {/*
            Inside the protected tree rather than a redirect to "/", so an unknown path is
            authenticated first and the URL survives. A catch-all that bounces to the home page
            runs before ProtectedRoute, which means a signed-out practitioner following a link
            loses the destination they were sent — they sign in and arrive somewhere else, with
            nothing to say what happened.
          */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

/**
 * The expiry handler lives inside the protected tree so it is mounted exactly while there is a
 * session to lose. Sessions are server-side and revocable, so an expiry can arrive at any moment
 * from any request; without this the shell keeps rendering while every panel under it fails,
 * which looks like a broken application rather than a session that ended.
 */
function SessionAwareShell() {
  useSessionExpiryHandler();
  return <AppShell />;
}

function NotFound() {
  const location = useLocation();

  return (
    <Empty
      title="Η σελίδα δεν βρέθηκε."
      hint={`Η διεύθυνση ${location.pathname} δεν αντιστοιχεί σε κάποια οθόνη.`}
      action={
        <Link className="button button--secondary" to="/">
          {strings.common.back}
        </Link>
      }
    />
  );
}

/** Placeholder. The client list takes this route in Block 3. */
function Home() {
  return (
    <>
      <h1 style={{ fontSize: 'var(--text-xl)' }}>Πελάτες</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
        Η λίστα πελατών έρχεται στο επόμενο βήμα.
      </p>
    </>
  );
}
