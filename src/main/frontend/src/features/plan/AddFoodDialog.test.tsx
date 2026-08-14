import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';

import type { FoodResponse } from '@/api/types';
import { createQueryClient } from '@/api/queryClient';
import { AddFoodDialog } from './AddFoodDialog';

vi.mock('@/features/food/foodQueries', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useFoods: vi.fn(),
}));

const { useFoods } = await import('@/features/food/foodQueries');

function food(overrides: Partial<FoodResponse> = {}): FoodResponse {
  return {
    id: 7,
    nameEl: 'Γιαούρτι στραγγιστό 2%',
    nameEn: null,
    category: 'PROTEIN',
    energyKcal: 73,
    proteinG: 10,
    carbohydrateG: 4,
    fatG: 2,
    source: 'DEMO_SEED',
    portions: [
      { id: 11, label: 'κεσεδάκι', grams: 200, isDefault: true },
      { id: 12, label: '100 γραμμάρια', grams: 100, isDefault: false },
    ],
    global: true,
    overridden: false,
    overridesFoodId: null,
    ...overrides,
  };
}

function renderDialog(foods: FoodResponse[], onAdd = vi.fn()) {
  vi.mocked(useFoods).mockReturnValue({
    data: { content: foods, page: 0, size: 20, totalElements: foods.length, totalPages: 1, last: true },
    isPending: false,
    error: null,
    refetch: vi.fn(),
  } as never);

  render(
    <QueryClientProvider client={createQueryClient()}>
      <AddFoodDialog
        open
        dayLabel="Δευτέρα"
        mealLabel="Πρωινό"
        busy={false}
        error={null}
        onAdd={onAdd}
        onClose={vi.fn()}
      />
    </QueryClientProvider>,
  );
  return onAdd;
}

describe('AddFoodDialog', () => {
  beforeEach(() => {
    // happy-dom does not implement the modal dialog methods.
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
  });

  afterEach(cleanup);

  it('should never offer a portion choice that sends no portion id', async () => {
    // Given — the defect this guards. `PlanService.choosePortion` treats a missing portionId as
    // "use the food's default", not as grams, so a "Γραμμάρια" option would quietly turn
    // "150 grams" into "150 × κεσεδάκι" — a wrong prescription reached without any error.
    renderDialog([food()]);
    await userEvent.click(screen.getByText('Γιαούρτι στραγγιστό 2%'));

    // When
    const select = (await screen.findByLabelText('Μερίδα')) as HTMLSelectElement;

    // Then — every option carries a real portion id
    const values = [...select.options].map((option) => option.value);
    expect(values).not.toContain('');
    expect(values.every((value) => Number.isFinite(Number(value)) && value !== '')).toBe(true);
  });

  it('should preselect the food default portion', async () => {
    // Given — the unit the food was defined with, which is what it was picked for
    renderDialog([food()]);
    await userEvent.click(screen.getByText('Γιαούρτι στραγγιστό 2%'));

    // When / Then
    const select = (await screen.findByLabelText('Μερίδα')) as HTMLSelectElement;
    expect(select.value).toBe('11');
  });

  it('should fall back to the first portion when none is marked default', async () => {
    // Given — data that predates the single-default rule
    renderDialog([
      food({
        portions: [
          { id: 21, label: 'φέτα', grams: 30, isDefault: false },
          { id: 22, label: 'μερίδα', grams: 60, isDefault: false },
        ],
      }),
    ]);
    await userEvent.click(screen.getByText('Γιαούρτι στραγγιστό 2%'));

    // When / Then — a portion is chosen rather than the field sitting empty
    const select = (await screen.findByLabelText('Μερίδα')) as HTMLSelectElement;
    expect(select.value).toBe('21');
  });

  it('should say what the unit is, when a food has no portions at all', async () => {
    // Given — the one case where quantity really is a multiple of weight: the server
    // synthesises a 100 g unit, so "2" means 200 g and the label has to say so
    renderDialog([food({ portions: [] })]);
    await userEvent.click(screen.getByText('Γιαούρτι στραγγιστό 2%'));

    // When / Then
    expect(await screen.findByLabelText('Ποσότητα (× 100 g)')).toBeDefined();
    expect(screen.queryByLabelText('Μερίδα')).toBeNull();
  });

  it('should send the chosen portion and quantity', async () => {
    // Given
    const onAdd = renderDialog([food()]);
    await userEvent.click(screen.getByText('Γιαούρτι στραγγιστό 2%'));

    // When
    const quantity = await screen.findByLabelText('Ποσότητα');
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '2');
    await userEvent.click(screen.getByRole('button', { name: 'Προσθήκη' }));

    // Then
    await waitFor(() =>
      expect(onAdd).toHaveBeenCalledWith({ foodId: 7, portionId: 11, quantity: 2 }),
    );
  });

  it('should refuse a quantity of zero or nothing', async () => {
    // Given — the server rejects anything below 0.001, and a disabled button explains that
    // better than a round trip does
    renderDialog([food()]);
    await userEvent.click(screen.getByText('Γιαούρτι στραγγιστό 2%'));

    const quantity = await screen.findByLabelText('Ποσότητα');
    const add = screen.getByRole('button', { name: 'Προσθήκη' });

    // When / Then
    await userEvent.clear(quantity);
    expect(add).toBeDisabled();

    await userEvent.type(quantity, '0');
    expect(add).toBeDisabled();

    await userEvent.clear(quantity);
    await userEvent.type(quantity, '1.5');
    expect(add).toBeEnabled();
  });

  it('should mark an overridden food in the results', async () => {
    // Given — its values are the practitioner's own, and they are about to become a plan line
    renderDialog([food({ global: false, overridden: true, overridesFoodId: 3 })]);

    // When / Then
    expect(await screen.findByText('Τροποποιημένο')).toBeDefined();
  });
});
