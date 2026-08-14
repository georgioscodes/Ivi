import { useEffect, useRef, useState } from 'react';

import { messageFor } from '@/api/messages';
import type { PlanItemResponse } from '@/api/types';
import { strings } from '@/strings';
import './plan.css';

interface RenameItemDialogProps {
  item: PlanItemResponse | null;
  busy: boolean;
  error: unknown;
  /** An empty string clears the override and restores the catalogue name. */
  onSave: (nameOverride: string) => void;
  onClose: () => void;
}

/**
 * The name this item prints under.
 *
 * A catalogue entry is often generic where the plan needs to be specific — "αρνί" on the shelf,
 * "αρνί σπάλα" on the sheet the client takes home. The override changes only what is printed;
 * the composition behind it is untouched.
 *
 * **The response cannot tell us whether a name is already overridden.** `PlanItemResponse.name`
 * is the resolved display name, and neither the original food name nor the override is exposed
 * separately — so this dialog cannot say "currently overridden from X". Clearing the field is
 * offered as an explicit action instead, and the result is visible the moment the plan comes
 * back. Adding `nameOverride` to the DTO would let this be stated rather than implied.
 */
export function RenameItemDialog({ item, busy, error, onSave, onClose }: RenameItemDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (item && !dialog.open) {
      setValue(item.name);
      dialog.showModal();
      inputRef.current?.select();
    } else if (!item && dialog.open) {
      dialog.close();
    }
  }, [item]);

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby="rename-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) {
          onClose();
        }
      }}
    >
      <h2 className="dialog__title" id="rename-title">
        Ονομασία για εκτύπωση
      </h2>
      <p className="dialog__body">
        Αλλάζει μόνο πώς εμφανίζεται το τρόφιμο στο πλάνο. Οι θρεπτικές τιμές παραμένουν ίδιες.
      </p>

      {error ? (
        <p className="form-error" role="alert">
          {messageFor(error)}
        </p>
      ) : null}

      <div className="field">
        <label className="field__label" htmlFor="rename-input">
          Ονομασία
        </label>
        <input
          ref={inputRef}
          id="rename-input"
          className="field__input"
          maxLength={200}
          value={value}
          disabled={busy}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && value.trim() !== '') {
              event.preventDefault();
              onSave(value.trim());
            }
          }}
        />
      </div>

      <div className="dialog__actions">
        {/* Sends an empty string, which the server reads as "clear the override" rather than as
            "set the name to nothing". */}
        <button
          type="button"
          className="button button--link rename__reset"
          onClick={() => onSave('')}
          disabled={busy}
        >
          Επαναφορά αρχικής ονομασίας
        </button>
        <button type="button" className="button button--secondary" onClick={onClose} disabled={busy}>
          {strings.common.cancel}
        </button>
        <button
          type="button"
          className="button button--primary"
          disabled={busy || value.trim() === ''}
          onClick={() => onSave(value.trim())}
        >
          {busy ? strings.common.saving : strings.common.save}
        </button>
      </div>
    </dialog>
  );
}
