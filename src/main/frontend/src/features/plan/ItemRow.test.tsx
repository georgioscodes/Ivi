import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { PlanItemResponse } from '@/api/types';
import { ItemRow, type ItemActions } from './ItemRow';

function item(overrides: Partial<PlanItemResponse> = {}): PlanItemResponse {
  return {
    id: 5,
    foodId: 7,
    name: 'Γιαούρτι στραγγιστό 2%',
    portionLabel: 'κεσεδάκι',
    portionGrams: 200,
    quantity: 2,
    totalGrams: 400,
    energyKcal: 292,
    proteinG: 40,
    carbohydrateG: 16,
    fatG: 8,
    sortOrder: 0,
    ...overrides,
  };
}

function actions(overrides: Partial<ItemActions> = {}): ItemActions {
  return {
    onQuantityChange: vi.fn(),
    onRename: vi.fn(),
    onRemove: vi.fn(),
    pendingItemId: null,
    ...overrides,
  };
}

describe('ItemRow quantity editing', () => {
  afterEach(cleanup);

  /**
   * Real timers, not fake ones. userEvent and Testing Library's waitFor each drive their own
   * clock, and pinning all three together is more machinery than a 600ms debounce is worth —
   * these tests simply wait it out.
   */
  const DEBOUNCE = 600;
  const settle = (ms = DEBOUNCE + 300) => new Promise((resolve) => setTimeout(resolve, ms));

  it('should commit once when typing stops, not once per keystroke', async () => {
    // Given — typing "150" fires requests for 1, 15 and 150 without a debounce, and those
    // answers can arrive out of order, so the row settles on the totals for 15.
    const handlers = actions();
    render(<ItemRow item={item()} actions={handlers} />);

    // When
    const field = screen.getByLabelText(/Ποσότητα/);
    await userEvent.clear(field);
    await userEvent.type(field, '150');
    await settle();

    // Then
    expect(handlers.onQuantityChange).toHaveBeenCalledTimes(1);
    expect(handlers.onQuantityChange).toHaveBeenCalledWith(5, 150);
  });

  it('should commit on blur without waiting out the pause', async () => {
    // Given — a practitioner who types and immediately clicks elsewhere expects it saved
    const handlers = actions();
    render(<ItemRow item={item()} actions={handlers} />);

    // When
    const field = screen.getByLabelText(/Ποσότητα/);
    await userEvent.clear(field);
    await userEvent.type(field, '3');
    field.blur();

    // Then — immediately, without waiting out the pause
    await waitFor(() => expect(handlers.onQuantityChange).toHaveBeenCalledWith(5, 3));
  });

  it('should restore the last confirmed value rather than sending an empty field', async () => {
    // Given — clearing the box is not a request to set the quantity to zero, and the server
    // would reject it anyway
    const handlers = actions();
    render(<ItemRow item={item()} actions={handlers} />);

    // When
    const field = screen.getByLabelText(/Ποσότητα/) as HTMLInputElement;
    await userEvent.clear(field);
    field.blur();

    // Then
    await waitFor(() => expect(field.value).toBe('2'));
    expect(handlers.onQuantityChange).not.toHaveBeenCalled();
  });

  it('should not send a value that is unchanged', async () => {
    // Given — tabbing through a row should not write to the plan
    const handlers = actions();
    render(<ItemRow item={item()} actions={handlers} />);

    // When
    const field = screen.getByLabelText(/Ποσότητα/);
    field.focus();
    field.blur();
    await settle();

    // Then
    expect(handlers.onQuantityChange).not.toHaveBeenCalled();
  });

  it('should reject zero and let the confirmed value stand', async () => {
    // Given — the server's minimum is 0.001
    const handlers = actions();
    render(<ItemRow item={item()} actions={handlers} />);

    // When
    const field = screen.getByLabelText(/Ποσότητα/) as HTMLInputElement;
    await userEvent.clear(field);
    await userEvent.type(field, '0');
    field.blur();

    // Then
    await waitFor(() => expect(field.value).toBe('2'));
    expect(handlers.onQuantityChange).not.toHaveBeenCalled();
  });
});

describe('ItemRow display', () => {
  afterEach(cleanup);

  it('should keep the last confirmed figures on screen while saving', () => {
    // Given — an edit in flight. The old numbers are what the server last confirmed; replacing
    // them with a guess is the failure this design exists to prevent, and blanking them makes
    // the row jump.
    render(<ItemRow item={item()} actions={actions({ pendingItemId: 5 })} />);

    // Then
    expect(screen.getByText(/292/)).toBeDefined();
    expect(screen.getByText(/αποθήκευση/)).toBeDefined();
  });

  it('should stop accepting input while a change is in flight', () => {
    // Given
    render(<ItemRow item={item()} actions={actions({ pendingItemId: 5 })} />);

    // Then
    expect(screen.getByLabelText(/Ποσότητα/)).toBeDisabled();
    expect(screen.getByRole('button', { name: /Αφαίρεση/ })).toBeDisabled();
  });

  it('should mark an item whose food has left the catalogue', () => {
    // Given — the prescription is a fact about the past and does not stop being true
    render(<ItemRow item={item({ foodId: null })} />);

    // Then
    expect(screen.getByText(/εκτός καταλόγου/)).toBeDefined();
  });

  it('should render read-only when no actions are supplied', () => {
    // Given — the same component serves the read-only view
    render(<ItemRow item={item()} />);

    // Then
    expect(screen.queryByLabelText(/Ποσότητα/)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
