import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import type { MacroTotals, PlanResponse } from '@/api/types';
import { PlanAnalysis } from './PlanAnalysis';

function totals(energyKcal: number, proteinG = 0, carbohydrateG = 0, fatG = 0): MacroTotals {
  return { energyKcal, proteinG, carbohydrateG, fatG };
}

function plan(overrides: Partial<PlanResponse> = {}): PlanResponse {
  return {
    id: 1,
    clientId: 1,
    name: 'Πλάνο',
    status: 'DRAFT',
    targets: totals(2000, 120, 250, 67),
    basis: null,
    activityFactor: null,
    notes: null,
    days: [],
    dailyAverage: totals(0),
    dailyAveragePercent: totals(0),
    version: 1,
    createdAt: '2026-08-14T00:00:00Z' as unknown as PlanResponse['createdAt'],
    updatedAt: '2026-08-14T00:00:00Z' as unknown as PlanResponse['updatedAt'],
    ...overrides,
  };
}

function day(id: number, dayIndex: number, dayTotals: MacroTotals, percent: MacroTotals) {
  return { id, dayIndex, label: null, meals: [], totals: dayTotals, targetPercent: percent };
}

describe('PlanAnalysis', () => {
  it('should show every day of the plan on its own row', () => {
    // Given — the point of the table is the days next to each other, which is the one thing the
    // per-day bars cannot show
    render(
      <PlanAnalysis
        plan={plan({
          days: [
            day(10, 0, totals(1850, 118, 210, 60), totals(93, 98, 84, 90)),
            day(11, 1, totals(2100, 130, 260, 70), totals(105, 108, 104, 104)),
          ],
        })}
      />,
    );

    expect(screen.getByRole('row', { name: /Δευτέρα/ })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Τρίτη/ })).toBeInTheDocument();
  });

  it('should show the percentage the server sent, not one it worked out from the totals', () => {
    // Given — a day whose percentage does not follow from its totals. If anything here divided
    // 1.000 by the 2.000 target it would print 50%; the response says 64% and the response is the
    // authority. Contrived, but it is exactly what rounding differences look like in miniature,
    // and it is the property the whole builder rests on.
    render(
      <PlanAnalysis
        plan={plan({ days: [day(10, 0, totals(1000, 60, 125, 33), totals(64, 64, 64, 64))] })}
      />,
    );

    const row = screen.getByRole('row', { name: /Δευτέρα/ });
    expect(within(row).getByText('1.000')).toBeInTheDocument();
    expect(within(row).getAllByText('64%')).toHaveLength(4);
    expect(within(row).queryByText('50%')).not.toBeInTheDocument();
  });

  it('should carry the daily average as the table last row', () => {
    // Given — an average belongs against the days it averages. It used to sit up beside the
    // targets, where the same four numbers appeared twice on one screen.
    render(
      <PlanAnalysis
        plan={plan({
          days: [day(10, 0, totals(1850), totals(93)), day(11, 1, totals(2150), totals(108))],
          // Supplied, not derived. The component has both day rows in front of it and still does
          // not add them up — if it did, this fixture would be the place it showed.
          dailyAverage: totals(2000, 124, 235, 65),
          dailyAveragePercent: totals(100, 103, 94, 97),
        })}
      />,
    );

    const average = screen.getByRole('row', { name: /Μέσος όρος/ });
    expect(within(average).getByText('2.000')).toBeInTheDocument();
    expect(within(average).getByText('2 ημέρες')).toBeInTheDocument();
  });

  it('should say over target in words, not only in red', () => {
    // Given — the palette rules forbid colour as the sole carrier of meaning, and this table is
    // also what gets printed in greyscale
    render(
      <PlanAnalysis plan={plan({ days: [day(10, 0, totals(2600), totals(130, 90, 90, 90))] })} />,
    );

    const row = screen.getByRole('row', { name: /Δευτέρα/ });
    expect(within(row).getByText(', πάνω από τον στόχο')).toBeInTheDocument();
    // And only for the macro that is over — the other three are under and must not be flagged.
    expect(within(row).getAllByText(', πάνω από τον στόχο')).toHaveLength(1);
  });

  it('should show the targets the days are measured against', () => {
    render(<PlanAnalysis plan={plan({ days: [day(10, 0, totals(1850), totals(93))] })} />);

    const targetRow = screen.getByRole('row', { name: /Στόχος/ });
    expect(within(targetRow).getByText('2.000')).toBeInTheDocument();
    expect(within(targetRow).getByText('120,0')).toBeInTheDocument();
  });

  it('should hold a plan with no days without falling over', () => {
    // Given — a plan is scaffolded with days, so this should not happen. It renders rather than
    // throws because a builder that crashes takes the practitioner's whole screen with it.
    render(<PlanAnalysis plan={plan()} />);

    expect(screen.getByRole('row', { name: /Μέσος όρος/ })).toBeInTheDocument();
  });
});
