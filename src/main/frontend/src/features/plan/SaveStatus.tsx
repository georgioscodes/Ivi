import { ApiError } from '@/api/ApiError';
import { messageFor } from '@/api/messages';
import { strings } from '@/strings';
import './plan.css';

export type SaveState = 'idle' | 'saving' | 'saved' | 'conflict' | 'failed';

/**
 * Where the plan stands: saving, saved, or not saved.
 *
 * A plan builder has no save button — every edit commits on its own — so the only way a
 * practitioner knows their work is safe is this. Getting it wrong in the reassuring direction is
 * the worst failure the screen can have.
 */
export function SaveStatus({
  state,
  error,
  onReload,
  onRetry,
}: {
  state: SaveState;
  error: unknown;
  onReload: () => void;
  onRetry?: () => void;
}) {
  if (state === 'idle') {
    return null;
  }

  if (state === 'saving') {
    return (
      <p className="save-status save-status--saving" role="status">
        {strings.common.saving}
      </p>
    );
  }

  if (state === 'saved') {
    return (
      <p className="save-status save-status--saved" role="status">
        <span aria-hidden="true">✓ </span>
        {strings.common.saved}
      </p>
    );
  }

  if (state === 'conflict') {
    return (
      <div className="save-status save-status--conflict" role="alert">
        <p>
          <span aria-hidden="true">⚠ </span>
          {/*
            Deliberately not "somebody else changed this". The likeliest cause is the
            practitioner's own two devices, or two of their own actions landing together — and
            the plan version is shared across the whole plan, so edits that conflict over nothing
            in common still collide. Saying "changed elsewhere" would name a culprit that may not
            exist. What matters is the part that is always true: the change did not save.
          */}
          Η αλλαγή σας δεν αποθηκεύτηκε, επειδή το πλάνο τροποποιήθηκε ταυτόχρονα από αλλού.
          Ανανεώστε για να δείτε την τρέχουσα έκδοση και εφαρμόστε την ξανά.
        </p>
        <button type="button" className="button button--secondary" onClick={onReload}>
          {strings.common.reload}
        </button>
      </div>
    );
  }

  const transient = error instanceof ApiError && error.isTransient;

  return (
    <div className="save-status save-status--failed" role="alert">
      <p>
        <span aria-hidden="true">⚠ </span>
        {messageFor(error)}
      </p>
      {/*
        Retry is offered only for a fault that might pass — a network drop or a server error. A
        rejection will be rejected identically, and a button that cannot work is worse than none.
        It is never automatic: a request that timed out may well have been applied, and
        re-sending an "add" would put the food in the plan twice.
      */}
      {transient && onRetry ? (
        <button type="button" className="button button--secondary" onClick={onRetry}>
          {strings.common.retry}
        </button>
      ) : null}
    </div>
  );
}
