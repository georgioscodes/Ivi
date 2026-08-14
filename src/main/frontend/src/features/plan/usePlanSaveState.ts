import { useEffect, useRef, useState } from 'react';

import { ApiError } from '@/api/ApiError';
import type { SaveState } from './SaveStatus';

interface MutationLike {
  isPending: boolean;
  error: unknown;
  isSuccess: boolean;
  submittedAt?: number;
}

/**
 * One save state for the whole plan, from however many mutations are in play.
 *
 * The practitioner does not think in terms of "the update-item mutation" — they think the plan is
 * saved or it is not. Three separate indicators would be three chances to show a stale one.
 *
 * "Saved" fades after a moment. A permanent tick beside a plan the practitioner has not touched
 * for ten minutes is not information, and it makes the one that matters — the failure — easier
 * to miss among furniture.
 */
export function usePlanSaveState(mutations: MutationLike[]): {
  state: SaveState;
  error: unknown;
} {
  const [showSaved, setShowSaved] = useState(false);
  const wasPending = useRef(false);

  const pending = mutations.some((mutation) => mutation.isPending);
  const failed = mutations.find((mutation) => mutation.error);

  useEffect(() => {
    if (wasPending.current && !pending && !failed) {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 2500);
      return () => clearTimeout(timer);
    }
    wasPending.current = pending;
    return undefined;
  }, [pending, failed]);

  useEffect(() => {
    wasPending.current = pending;
  }, [pending]);

  if (pending) {
    return { state: 'saving', error: null };
  }

  if (failed?.error) {
    // A conflict that survived the automatic retry is a genuine race over the same record, and
    // reads differently from a server fault: nothing is broken, the change simply did not land.
    const conflict = failed.error instanceof ApiError && failed.error.isConflict;
    return { state: conflict ? 'conflict' : 'failed', error: failed.error };
  }

  return { state: showSaved ? 'saved' : 'idle', error: null };
}
