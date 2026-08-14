import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import type { MacroTotals } from '@/api/types';
import { MacroProgress } from './MacroProgress';

const targets: MacroTotals = {
  energyKcal: 2000,
  proteinG: 120,
  carbohydrateG: 250,
  fatG: 67,
};

function renderBars(totals: MacroTotals, percent: MacroTotals) {
  return render(<MacroProgress totals={totals} percent={percent} targets={targets} />);
}

describe('MacroProgress', () => {
  afterEach(cleanup);

  it('should use the percentage the server supplied, not one it worked out', () => {
    // Given — totals and percentages that do not agree. The server's number wins, because
    // recomputing here is the second implementation this architecture exists to avoid.
    renderBars(
      { energyKcal: 1000, proteinG: 60, carbohydrateG: 125, fatG: 33 },
      { energyKcal: 42, proteinG: 42, carbohydrateG: 42, fatG: 42 },
    );

    // Then — 42%, not the 50% the figures would imply
    for (const bar of screen.getAllByRole('progressbar')) {
      expect(bar.getAttribute('aria-valuenow')).toBe('42');
    }
  });

  it('should cap the bar at full width when a day runs over', () => {
    // Given — 180% of the fat target. A bar drawn at 180% paints over the layout beside it.
    renderBars(
      { energyKcal: 2000, proteinG: 120, carbohydrateG: 250, fatG: 120 },
      { energyKcal: 100, proteinG: 100, carbohydrateG: 100, fatG: 180 },
    );

    const fat = screen.getByRole('progressbar', { name: /Λίπος/ });
    const fill = fat.querySelector('.bar__fill') as HTMLElement;

    // Then — the width stops at 100; the number and the label carry the excess
    expect(fill.style.width).toBe('100%');
  });

  it('should say "over target" in words, not only in colour', () => {
    // Given — a red bar and a black bar are the same bar to a colour-blind practitioner, and
    // identical on a greyscale printout of a plan
    renderBars(
      { energyKcal: 2600, proteinG: 120, carbohydrateG: 250, fatG: 67 },
      { energyKcal: 130, proteinG: 100, carbohydrateG: 100, fatG: 100 },
    );

    // Then
    expect(screen.getByText(/πάνω από τον στόχο/)).toBeDefined();
    expect(
      screen.getByRole('progressbar', { name: /Ενέργεια/ }).getAttribute('aria-valuetext'),
    ).toContain('πάνω από τον στόχο');
  });

  it('should not flag a day that is exactly on target', () => {
    // Given — 100% is met, not exceeded
    renderBars(
      { energyKcal: 2000, proteinG: 120, carbohydrateG: 250, fatG: 67 },
      { energyKcal: 100, proteinG: 100, carbohydrateG: 100, fatG: 100 },
    );

    // Then
    expect(screen.queryByText(/πάνω από τον στόχο/)).toBeNull();
  });

  it('should show the value and the target beside every bar', () => {
    // Given — two of the four series colours measure below 3:1 against the surface, which is
    // permitted only alongside a visible label. A bar without its number also makes the
    // practitioner estimate a figure the server already knows exactly.
    renderBars(
      { energyKcal: 1850, proteinG: 118.4, carbohydrateG: 244.2, fatG: 61.7 },
      { energyKcal: 93, proteinG: 99, carbohydrateG: 98, fatG: 92 },
    );

    // Then — Greek decimal comma, and the target alongside
    expect(screen.getByText(/1\.850/)).toBeDefined();
    expect(screen.getByText(/118,4/)).toBeDefined();
    expect(screen.getByText('/ 120,0')).toBeDefined();
  });

  it('should give each bar an accessible name and a readable value', () => {
    // Given — a bar with no name is a rectangle to a screen reader
    renderBars(
      { energyKcal: 1000, proteinG: 60, carbohydrateG: 125, fatG: 33 },
      { energyKcal: 50, proteinG: 50, carbohydrateG: 50, fatG: 50 },
    );

    // Then
    const bars = screen.getAllByRole('progressbar');
    expect(bars).toHaveLength(4);
    for (const bar of bars) {
      expect(bar.getAttribute('aria-label')).toMatch(/\S/);
      expect(bar.getAttribute('aria-valuetext')).toMatch(/%/);
    }
  });
});
