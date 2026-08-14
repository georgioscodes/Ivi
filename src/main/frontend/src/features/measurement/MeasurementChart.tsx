import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { MeasurementSeriesResponse } from '@/api/types';
import { formatChange, formatValue } from './measurementFormat';
import './measurement.css';

interface MeasurementChartProps {
  series: MeasurementSeriesResponse;
  decimals: number;
}

/**
 * One measurement type over time.
 *
 * A line, because the question is change over time and the readings are an ordered sequence.
 * One series, so there is no legend — the heading names it, and identity is never carried by
 * colour alone because there is nothing to tell it apart from.
 *
 * The colour is a validated categorical slot, not a brand colour. The brand five cannot encode
 * data: four of them sit in one narrow luminance band and the closest pair differs by 1.01 in
 * contrast. See docs/ui-palette.md.
 *
 * Nothing here is computed. Every value and every delta arrives from `GET /measurement/series`,
 * including `changeFromPrevious`, which the tooltip shows.
 */
export function MeasurementChart({ series, decimals }: MeasurementChartProps) {
  const data = series.points.map((point) => ({
    ...point,
    // Short axis labels: a Greek month name at every tick collides on a narrow card.
    axisLabel: new Intl.DateTimeFormat('el-GR', { month: 'short', day: 'numeric' }).format(
      new Date(point.recordedOn),
    ),
  }));

  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          {/* Horizontal only, and recessive. Vertical lines add nothing when the x-axis is a
              handful of dated visits, and a heavy grid competes with the line it frames. */}
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />

          <XAxis
            dataKey="axisLabel"
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            stroke="var(--chart-grid)"
            tickLine={false}
          />
          <YAxis
            // Not zero-based on purpose. A weight series runs 78–84 kg; anchoring at zero
            // compresses the change into a flat line, which is the opposite of what the chart
            // is for. Trends, not magnitudes.
            domain={['auto', 'auto']}
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            stroke="var(--chart-grid)"
            tickLine={false}
            width={52}
            tickFormatter={(value: number) => formatValue(value, decimals)}
          />

          <Tooltip
            content={<SeriesTooltip unit={series.unit} decimals={decimals} />}
            cursor={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }}
          />

          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--series-1)"
            strokeWidth={2}
            // Visible dots: the readings are the data, and there may only be four of them.
            dot={{ r: 4, strokeWidth: 2, fill: 'var(--surface-raised)' }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: { recordedOn: string; value: number; changeFromPrevious: number | null } }[];
  unit: string;
  decimals: number;
}

function SeriesTooltip({ active, payload, unit, decimals }: TooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) {
    return null;
  }

  return (
    <div className="chart__tooltip">
      <p className="chart__tooltip-date">
        {new Intl.DateTimeFormat('el-GR', { dateStyle: 'medium' }).format(
          new Date(point.recordedOn),
        )}
      </p>
      <p className="chart__tooltip-value">
        {formatValue(point.value, decimals)} {unit}
      </p>
      {point.changeFromPrevious !== null ? (
        <p className="chart__tooltip-change">
          {formatChange(point.changeFromPrevious, decimals)} {unit} από την προηγούμενη
        </p>
      ) : null}
    </div>
  );
}
