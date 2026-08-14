import type { MacroTotals } from '@/api/types';
import { formatGrams, formatKcal, formatPercent } from './planLabels';
import './plan.css';

/**
 * The four macro bars for a day, against that day's targets.
 *
 * Each bar's width is a percentage the **server** supplied. Nothing here divides a total by a
 * target: `targetPercent` arrives on every day of the response precisely so this component does
 * not have to, and a second implementation would disagree with the first at the rounding
 * boundary.
 *
 * No chart library. A bar is a div with a width, and Recharts would add a hundred kilobytes to
 * draw a rectangle.
 */
export function MacroProgress({
  totals,
  percent,
  targets,
}: {
  totals: MacroTotals;
  percent: MacroTotals;
  targets: MacroTotals;
}) {
  const bars = [
    {
      key: 'energy',
      label: 'Ενέργεια',
      value: formatKcal(totals.energyKcal),
      target: formatKcal(targets.energyKcal),
      unit: 'kcal',
      pct: percent.energyKcal,
      colour: 'var(--series-1)',
    },
    {
      key: 'protein',
      label: 'Πρωτεΐνη',
      value: formatGrams(totals.proteinG),
      target: formatGrams(targets.proteinG),
      unit: 'g',
      pct: percent.proteinG,
      colour: 'var(--series-2)',
    },
    {
      key: 'carbohydrate',
      label: 'Υδατάνθρακες',
      value: formatGrams(totals.carbohydrateG),
      target: formatGrams(targets.carbohydrateG),
      unit: 'g',
      pct: percent.carbohydrateG,
      colour: 'var(--series-3)',
    },
    {
      key: 'fat',
      label: 'Λίπος',
      value: formatGrams(totals.fatG),
      target: formatGrams(targets.fatG),
      unit: 'g',
      pct: percent.fatG,
      colour: 'var(--series-4)',
    },
  ];

  return (
    <div className="bars">
      {bars.map(({ key, ...bar }) => (
        <Bar key={key} {...bar} />
      ))}
    </div>
  );
}

interface BarProps {
  label: string;
  value: string;
  target: string;
  unit: string;
  pct: number;
  colour: string;
}

function Bar({ label, value, target, unit, pct, colour }: BarProps) {
  const over = pct > 100;

  return (
    <div className={`bar${over ? ' bar--over' : ''}`}>
      <div className="bar__head">
        <span className="bar__label">{label}</span>
        {/*
          The number beside the bar, always. Two of the four series colours measure below 3:1
          against the surface, which is permitted only alongside a visible label — and a bar
          without its value makes a practitioner estimate a figure the server already knows.
        */}
        <span className="bar__value">
          {value} <span className="bar__unit">{unit}</span>
          <span className="bar__target"> / {target}</span>
        </span>
      </div>

      <div
        className="bar__track"
        role="progressbar"
        aria-label={`${label}: ${value} ${unit} από ${target} ${unit}`}
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${formatPercent(pct)}${over ? ', πάνω από τον στόχο' : ''}`}
      >
        {/* Capped at 100% so a 180% day does not paint over the layout. The number and the
            over-target label carry the excess; the bar only has 100% of width to give. */}
        <span
          className="bar__fill"
          style={{ width: `${Math.min(pct, 100)}%`, background: over ? 'var(--error)' : colour }}
        />
      </div>

      <p className="bar__pct">
        {formatPercent(pct)}
        {/*
          Over-target is never colour alone. The red fill is reinforcement; this text is what
          actually says it, and it is what a colour-blind practitioner and a greyscale printout
          both get.
        */}
        {over ? (
          <span className="bar__over-label">
            <span aria-hidden="true"> ⚠ </span>
            πάνω από τον στόχο
          </span>
        ) : null}
      </p>
    </div>
  );
}
