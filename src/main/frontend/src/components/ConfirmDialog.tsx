import { useEffect, useRef } from 'react';

import { strings } from '@/strings';
import './dialog.css';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** What will actually happen. Not "are you sure" — that asks nothing useful. */
  body: string;
  confirmLabel?: string;
  /** Marks the action as irreversible: red confirm, and the cancel button takes initial focus. */
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A modal confirmation, on the native `<dialog>` element.
 *
 * `showModal()` brings focus trapping, Escape-to-close, the backdrop and inertness of the rest of
 * the page with it, which is most of what a dialog library is for. The recorded decision was to
 * use Radix for dialogs; for this one the platform is enough, and Radix can earn its place in the
 * plan builder where popovers and comboboxes need behaviour the platform has no answer for.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = strings.common.confirm,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
      // For a destructive action the safe choice takes focus, so Enter does not delete a client.
      if (destructive) {
        cancelRef.current?.focus();
      }
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, destructive]);

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-body"
      // Escape closes the dialog natively; this keeps React's state in step with that.
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) {
          onCancel();
        }
      }}
    >
      <h2 className="dialog__title" id="confirm-title">
        {title}
      </h2>
      <p className="dialog__body" id="confirm-body">
        {body}
      </p>

      <div className="dialog__actions">
        <button
          type="button"
          ref={cancelRef}
          className="button button--secondary"
          onClick={onCancel}
          disabled={busy}
        >
          {strings.common.cancel}
        </button>
        <button
          type="button"
          className={`button ${destructive ? 'button--destructive' : 'button--primary'}`}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? strings.common.loading : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
