import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

import { ApiError } from '@/api/ApiError';
import { createQueryClient } from '@/api/queryClient';
import { GuestOnlyRoute, ProtectedRoute } from './ProtectedRoute';

/**
 * The three-way distinction the guard has to keep: still asking, failed to ask, and signed out.
 *
 * Collapsing "still asking" into "signed out" throws a signed-in practitioner onto the login
 * screen for a beat on every refresh. Collapsing "failed to ask" into "signed out" asks them to
 * retype a password that was never the problem, and hides the real failure.
 */
vi.mock('@/api/endpoints', () => ({
  practitioner: { me: vi.fn() },
  auth: { login: vi.fn(), logout: vi.fn() },
  clients: {},
}));

const { practitioner } = await import('@/api/endpoints');
const me = vi.mocked(practitioner.me);

function renderAt(path: string, element: ReactNode) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<LoginProbe />} />
          <Route path="/" element={<p>αρχική</p>} />
          <Route path="*" element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Stands in for the login page, and reports the destination it was handed. */
function LoginProbe() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '(none)';
  return <p>σύνδεση from={from}</p>;
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    me.mockReset();
  });

  afterEach(cleanup);

  it('should wait rather than showing the login form, while the session is still unknown', async () => {
    // Given — a request that has not resolved. Every page load passes through this state.
    me.mockReturnValue(new Promise(() => {}));

    // When
    renderAt('/protected', <ProtectedRoute>μυστικό</ProtectedRoute>);

    // Then — a flash of the login screen on every refresh is the failure being avoided
    expect(await screen.findByRole('status')).toBeDefined();
    expect(screen.queryByText(/σύνδεση/)).toBeNull();
  });

  it('should render the content, once the practitioner is known', async () => {
    // Given
    me.mockResolvedValue({
      id: 1,
      email: 'eleni@example.gr',
      displayName: 'Ελένη',
      practiceName: null,
      createdAt: '2026-01-01T00:00:00Z' as never,
    });

    // When
    renderAt('/protected', <ProtectedRoute>μυστικό</ProtectedRoute>);

    // Then
    expect(await screen.findByText('μυστικό')).toBeDefined();
  });

  it('should send an unauthenticated visitor to sign in, remembering where they were going', async () => {
    // Given — a link into the application, followed by someone whose session has ended
    me.mockRejectedValue(new ApiError(401, 'Authentication required'));

    // When
    renderAt('/client/42/plan/7', <ProtectedRoute>μυστικό</ProtectedRoute>);

    // Then — signing in has to resume the journey, not restart it
    expect(await screen.findByText('σύνδεση from=/client/42/plan/7')).toBeDefined();
  });

  it('should show the failure, when the session check itself failed', async () => {
    // Given — a 500, not a 401. The practitioner is not signed out; the server is unwell.
    me.mockRejectedValue(new ApiError(500, 'Internal error'));

    // When
    renderAt('/protected', <ProtectedRoute>μυστικό</ProtectedRoute>);

    // Then — asking for a password would hide this behind a screen that cannot fix it
    const alert = await screen.findByRole('alert', {}, { timeout: 3000 });
    expect(alert.textContent).toContain('Κάτι πήγε στραβά');
    expect(screen.queryByText(/σύνδεση/)).toBeNull();
  });
});

describe('GuestOnlyRoute', () => {
  beforeEach(() => {
    me.mockReset();
  });

  afterEach(cleanup);

  it('should keep a signed-in practitioner off the sign-in screen', async () => {
    // Given — a bookmarked /login. Submitting it would rotate a session that was working.
    me.mockResolvedValue({
      id: 1,
      email: 'eleni@example.gr',
      displayName: 'Ελένη',
      practiceName: null,
      createdAt: '2026-01-01T00:00:00Z' as never,
    });

    // When
    renderAt('/guest', <GuestOnlyRoute>φόρμα σύνδεσης</GuestOnlyRoute>);

    // Then
    await waitFor(() => expect(screen.getByText('αρχική')).toBeDefined());
    expect(screen.queryByText('φόρμα σύνδεσης')).toBeNull();
  });

  it('should resume the journey, when sign-in followed a turned-away link', async () => {
    // Given — the practitioner followed a link, was sent to sign in, and has now signed in.
    // Landing them on the home page instead loses what they clicked, with nothing to explain it.
    me.mockResolvedValue({
      id: 1,
      email: 'eleni@example.gr',
      displayName: 'Ελένη',
      practiceName: null,
      createdAt: '2026-01-01T00:00:00Z' as never,
    });

    // When — this is the only place that decides the destination; the login page deliberately
    // does not navigate, because the two redirects raced and this one usually won
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: '/client/42' } }]}>
          <Routes>
            <Route
              path="/login"
              element={<GuestOnlyRoute>φόρμα σύνδεσης</GuestOnlyRoute>}
            />
            <Route path="/" element={<p>αρχική</p>} />
            <Route path="/client/42" element={<p>καρτέλα πελάτη</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Then
    expect(await screen.findByText('καρτέλα πελάτη')).toBeDefined();
  });

  it('should show the form to someone who is not signed in', async () => {
    // Given
    me.mockRejectedValue(new ApiError(401, 'Authentication required'));

    // When
    renderAt('/guest', <GuestOnlyRoute>φόρμα σύνδεσης</GuestOnlyRoute>);

    // Then
    expect(await screen.findByText('φόρμα σύνδεσης')).toBeDefined();
  });
});
