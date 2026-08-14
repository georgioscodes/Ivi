import { useEffect, useRef, useState } from 'react';

import type { PlanItemResponse } from '@/api/types';
import { formatGrams, formatKcal, formatQuantity } from './planLabels';
import './plan.css';

export interface ItemActions {
  onQuantityChange: (itemId: number, quantity: number) => void;
  onRename: (item: PlanItemResponse) => void;
  onRemove: (item: PlanItemResponse) => void;
  /** The item currently waiting on a request. */
  pendingItemId: number | null;
}

/**
 * One line in a meal, editable in place.
 *
 * The quantity is the only value typed here, and it is committed on a pause or on blur rather
 * than per keystroke. Typing "150" would otherwise fire three requests — for 1, 15 and 150 — and
 * the answers can arrive out of order, so the row could settle showing the totals for 15.
 *
 * While a change is in flight the **old** figures stay on screen. They are the last thing the
 * server actually confirmed; replacing them with a guess is the failure this design exists to
 * prevent, and blanking them makes the row jump.
 */
export function ItemRow({
  item,
  actions,
}: {
  item: PlanItemResponse;
  actions?: ItemActions;
}) {
  const pending = actions?.pendingItemId === item.id;

  return (
    <li className={`item${pending ? ' item--pending' : ''}`} aria-busy={pending || undefined}>
      <div className="item__line">
        <span className="item__name">
          {item.name}
          {/* The food was deleted from the catalogue after this was prescribed. The item stands,
              because it is a record of what was recommended. */}
          {item.foodId === null ? (
            <span className="item__orphan" title="Το τρόφιμο δεν υπάρχει πλέον στον κατάλογο">
              {' '}
              (εκτός καταλόγου)
            </span>
          ) : null}
        </span>

        {actions ? (
          <span className="item__actions">
            <button
              type="button"
              className="item__action"
              onClick={() => actions.onRename(item)}
              disabled={pending}
              title="Ονομασία για εκτύπωση"
            >
              <span aria-hidden="true">✎</span>
              <span className="visually-hidden">Ονομασία για εκτύπωση: {item.name}</span>
            </button>
            <button
              type="button"
              className="item__action item__action--remove"
              onClick={() => actions.onRemove(item)}
              disabled={pending}
              title="Αφαίρεση"
            >
              <span aria-hidden="true">×</span>
              <span className="visually-hidden">Αφαίρεση: {item.name}</span>
            </button>
          </span>
        ) : null}
      </div>

      <div className="item__line item__line--quantity">
        {actions ? (
          <QuantityInput
            item={item}
            disabled={pending}
            onCommit={(quantity) => actions.onQuantityChange(item.id, quantity)}
          />
        ) : (
          <span className="item__portion">{formatQuantity(item.quantity)}</span>
        )}
        <span className="item__portion">
          {item.portionLabel ? `× ${item.portionLabel} · ` : ''}
          {formatGrams(item.totalGrams)} g
        </span>
      </div>

      <span className="item__energy">
        {formatKcal(item.energyKcal)} kcal
        {pending ? <span className="item__saving"> · αποθήκευση…</span> : null}
      </span>
    </li>
  );
}

const COMMIT_DELAY_MS = 600;

/**
 * A quantity field that commits when the practitioner stops typing, or when they leave it.
 *
 * Longer than the 300ms used for search: a search that fires early is merely a wasted request,
 * where a quantity that fires early writes a value into a plan and moves four totals.
 */
function QuantityInput({
  item,
  disabled,
  onCommit,
}: {
  item: PlanItemResponse;
  disabled: boolean;
  onCommit: (quantity: number) => void;
}) {
  const [typed, setTyped] = useState(String(item.quantity));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committed = useRef(item.quantity);

  // Follow the server when it disagrees, but never while the practitioner is mid-edit: the
  // response to their *previous* keystroke would otherwise reset the field under their cursor.
  useEffect(() => {
    if (item.quantity !== committed.current) {
      committed.current = item.quantity;
      setTyped(String(item.quantity));
    }
  }, [item.quantity]);

  function schedule(raw: string) {
    setTyped(raw);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => commit(raw), COMMIT_DELAY_MS);
  }

  function commit(raw: string) {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    const value = Number(raw);
    // A blank or nonsense field is not a request to set the quantity to zero — the server would
    // reject it anyway — so the last confirmed value comes back instead.
    if (raw.trim() === '' || !Number.isFinite(value) || value <= 0) {
      setTyped(String(committed.current));
      return;
    }
    if (value === committed.current) {
      return;
    }

    committed.current = value;
    onCommit(value);
  }

  useEffect(() => () => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
  }, []);

  return (
    <input
      type="number"
      className="item__quantity"
      inputMode="decimal"
      min="0"
      step="0.25"
      value={typed}
      disabled={disabled}
      aria-label={`Ποσότητα: ${item.name}`}
      onChange={(event) => schedule(event.target.value)}
      onBlur={(event) => commit(event.target.value)}
      // Enter commits immediately: waiting out the pause after a deliberate keypress reads as
      // the application ignoring it.
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit((event.target as HTMLInputElement).value);
        }
      }}
    />
  );
}
