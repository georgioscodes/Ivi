import { useEffect, useId, useRef } from 'react';

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

  /*
    Generated, not hardcoded. A page renders several of these at once — the plan builder has
    three, all mounted, only one ever open — and with a fixed id every copy claimed the same one.
    `aria-labelledby` resolves against the first match in the document, so opening "Διαγραφή
    πλάνου" announced "Καθαρισμός ημέρας": a screen reader told the practitioner they were about
    to clear a day while the button under their finger deleted the plan. Measured in the browser,
    not inferred — the accessible name really did resolve to the wrong dialog's title.
  */
  const id = useId();
  const titleId = `${id}-title`;
  const bodyId = `${id}-body`;

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
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      // Escape closes the dialog natively; this keeps React's state in step with that.
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) {
          onCancel();
        }
      }}
    >
      <h2 className="dialog__title" id={titleId}>
        {title}
      </h2>
      <p className="dialog__body" id={bodyId}>
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
