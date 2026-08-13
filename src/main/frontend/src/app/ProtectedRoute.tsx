import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { ErrorState, Loading } from '@/components/states';
import { useSession } from '@/session/session';

/**
 * Renders its children only for a signed-in practitioner.
 *
 * Three states, and conflating any two of them is a bug someone will hit:
 *
 * - **Still asking.** Every load starts here. Rendering the login form during this beat throws a
 *   signed-in practitioner onto a sign-in screen for a moment on every refresh.
 * - **The check failed.** A server fault is not a signed-out practitioner. Sending them to type
 *   a password that was never the problem hides the actual failure.
 * - **Not signed in.** Only now is the login form correct.
 *
 * This is a convenience, not the security boundary. The boundary is the server: every endpoint
 * requires a session and every tenant-owned query is scoped to the practitioner behind it.
 * Removing this component would expose empty screens, not data.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { isSignedIn, isLoading, error } = useSession();

  if (isLoading) {
    return <Loading />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => window.location.reload()} />;
  }

  if (!isSignedIn) {
    // Where they were going, so signing in resumes it rather than dumping them on the home page.
    // `replace` keeps the unreachable URL out of history — going back should not retry it.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <>{children}</>;
}

/**
 * The mirror image: keeps a signed-in practitioner off the login and registration screens.
 *
 * Without it, a bookmarked `/login` shows a sign-in form to someone already signed in, and
 * submitting it rotates a session that was working.
 *
 * This is also the *only* place that decides where a successful sign-in lands. The login page
 * deliberately does not navigate on success. When it did, two things raced: writing the session
 * into the cache re-rendered this component, which redirected to `/` before the page's own
 * `navigate` to the intended destination took effect — so a practitioner who followed a link
 * signed in and arrived at the home page instead, silently and only sometimes.
 */
export function GuestOnlyRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { isSignedIn, isLoading } = useSession();

  if (isLoading) {
    return <Loading />;
  }

  if (!isSignedIn) {
    return <>{children}</>;
  }

  // Put there by ProtectedRoute when it turned someone away.
  const intended = (location.state as { from?: string } | null)?.from;
  return <Navigate to={intended ?? '/'} replace />;
}
