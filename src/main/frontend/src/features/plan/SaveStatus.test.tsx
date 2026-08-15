import { describe, expect, it, vi } from 'vitest';
import { render, renderHook, screen } from '@testing-library/react';
import { act } from 'react';

import { ApiError } from '@/api/ApiError';
import { strings } from '@/strings';
import { SaveStatus } from './SaveStatus';
import { usePlanSaveState } from './usePlanSaveState';

/**
 * The plan builder has no save button — every edit commits on its own — so this indicator is the
 * only thing telling a practitioner their work is safe. Getting it wrong in the *reassuring*
 * direction is the worst failure the screen can have, which is what most of these are about.
 */
describe('SaveStatus', () => {
  const noop = () => {};

  it('should show nothing at rest', () => {
    // Given — a permanent indicator on an untouched plan is furniture, and furniture is what the
    // one that matters gets lost among
    const { container } = render(<SaveStatus state="idle" error={null} onReload={noop} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should announce saving and saved politely, not as alerts', () => {
    // Given — role="status" is announced without interrupting. An assertive alert on every
    // keystroke-driven save would talk over a screen reader user continuously.
    const { rerender } = render(<SaveStatus state="saving" error={null} onReload={noop} />);
    expect(screen.getByRole('status')).toHaveTextContent('Αποθήκευση');

    rerender(<SaveStatus state="saved" error={null} onReload={noop} />);
    expect(screen.getByRole('status')).toHaveTextContent('Αποθηκεύτηκε');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should interrupt for a failure, because silence reads as success', () => {
    render(
      <SaveStatus state="failed" error={new ApiError(500, 'boom')} onReload={noop} />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('should not blame anyone for a conflict', () => {
    // Given — the plan's version is shared across the whole plan, so two of the practitioner's
    // own edits collide over nothing in common. "Somebody else changed this" names a culprit who
    // very likely does not exist.
    render(<SaveStatus state="conflict" error={null} onReload={noop} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/δεν αποθηκεύτηκε/);
    expect(alert.textContent).not.toMatch(/άλλος χρήστης|κάποιος άλλος/);
    expect(screen.getByRole('button', { name: strings.common.reload })).toBeInTheDocument();
  });

  it('should not offer retry for a conflict, which would conflict again', () => {
    const retry = vi.fn();
    render(<SaveStatus state="conflict" error={null} onReload={noop} onRetry={retry} />);

    expect(screen.queryByRole('button', { name: strings.common.retry })).not.toBeInTheDocument();
  });

  it('should offer retry for a fault that might pass', () => {
    // Given — a network drop or a 503. Offered, never automatic: a request that timed out may
    // already have been applied, and re-sending an "add" would put the food in twice.
    render(
      <SaveStatus
        state="failed"
        error={new ApiError(0, 'Network request failed')}
        onReload={noop}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: strings.common.retry })).toBeInTheDocument();
  });

  it('should not offer retry for a rejection, which would be rejected identically', () => {
    render(
      <SaveStatus
        state="failed"
        error={new ApiError(400, 'Quantity must be greater than zero')}
        onReload={noop}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: strings.common.retry })).not.toBeInTheDocument();
  });
});

describe('usePlanSaveState', () => {
  const at_rest = { isPending: false, error: null, isSuccess: false };

  it('should report saving while any mutation is in flight', () => {
    // Given — the practitioner thinks "the plan is saving", not "the update-item mutation is
    // pending". Three indicators would be three chances to show a stale one.
    const { result } = renderHook(() =>
      usePlanSaveState([at_rest, { isPending: true, error: null, isSuccess: false }, at_rest]),
    );
    expect(result.current.state).toBe('saving');
  });

  it('should let a failure outrank an idle mutation beside it', () => {
    const error = new ApiError(500, 'boom');
    const { result } = renderHook(() =>
      usePlanSaveState([at_rest, { isPending: false, error, isSuccess: false }]),
    );
    expect(result.current.state).toBe('failed');
    expect(result.current.error).toBe(error);
  });

  it('should tell a conflict apart from a fault', () => {
    // Given — a 409 that survived the automatic retry is a genuine race, and reads differently:
    // nothing is broken, the change simply did not land.
    const conflict = new ApiError(409, 'changed elsewhere');
    const { result } = renderHook(() =>
      usePlanSaveState([{ isPending: false, error: conflict, isSuccess: false }]),
    );
    expect(result.current.state).toBe('conflict');
  });

  it('should show saved after a save finishes, then let it fade', async () => {
    vi.useFakeTimers();
    try {
      const { result, rerender } = renderHook(
        ({ pending }: { pending: boolean }) =>
          usePlanSaveState([{ isPending: pending, error: null, isSuccess: !pending }]),
        { initialProps: { pending: true } },
      );
      expect(result.current.state).toBe('saving');

      rerender({ pending: false });
      expect(result.current.state).toBe('saved');

      // A tick beside a plan untouched for ten minutes is not information.
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });
      expect(result.current.state).toBe('idle');
    } finally {
      vi.useRealTimers();
    }
  });

  it('should never show saved when the save failed', () => {
    // Given — the reassuring direction is the dangerous one. A tick over an edit that did not
    // reach the server is how a practitioner loses work without ever knowing.
    const { result, rerender } = renderHook(
      ({ pending, error }: { pending: boolean; error: unknown }) =>
        usePlanSaveState([{ isPending: pending, error, isSuccess: false }]),
      { initialProps: { pending: true, error: null as unknown } },
    );

    rerender({ pending: false, error: new ApiError(500, 'boom') });
    expect(result.current.state).toBe('failed');
  });
});
