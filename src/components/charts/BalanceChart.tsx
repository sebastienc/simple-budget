import React, { useMemo } from 'react';
import clsx from 'clsx';
import { formatCentsAxis } from '@/lib/money';
import { formatISODate } from '@/lib/dates';

export interface BalancePoint {
  date: string;
  valueCents: number;
}

export interface BalanceChartProps {
  points: BalancePoint[];
  ariaLabel: string;
  className?: string;
}

/* Drawing box. Padding leaves room for the outermost tick labels. */
const W = 720;
const H = 236;
const PAD_L = 64;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 46;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

interface Vertex {
  x: number;
  v: number;
}

interface Run {
  negative: boolean;
  vertices: Vertex[];
}

/** A 1/2/2.5/5/10 × 10ⁿ step, so ticks land on numbers a person would choose. */
function niceStep(range: number, targetTicks: number): number {
  if (range <= 0) {
    return 1;
  }
  const rough = range / targetTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalized = rough / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

/**
 * The staircase, as a polyline in (x, value) space.
 *
 * A balance holds all day and jumps on the days something lands, so each point
 * contributes a horizontal run at the previous value followed by a vertical
 * jump to its own. Drawing it as a slope would imply money trickling in.
 */
function buildVertices(points: BalancePoint[], xAt: (index: number) => number): Vertex[] {
  const vertices: Vertex[] = [{ x: xAt(0), v: points[0].valueCents }];
  for (let i = 1; i < points.length; i++) {
    vertices.push({ x: xAt(i), v: points[i - 1].valueCents });
    vertices.push({ x: xAt(i), v: points[i].valueCents });
  }
  return vertices;
}

/**
 * Splits the staircase into above-zero and below-zero runs.
 *
 * Because horizontal segments hold the value constant, a sign change can only
 * ever happen on a vertical segment — so the crossing point is exactly
 * (that segment's x, 0). No interpolation, and the colour changes on precisely
 * the day the account goes under.
 */
function splitBySign(vertices: Vertex[]): Run[] {
  const runs: Run[] = [];
  let current: Run = { negative: vertices[0].v < 0, vertices: [vertices[0]] };

  for (let i = 1; i < vertices.length; i++) {
    const vertex = vertices[i];
    const isNegative = vertex.v < 0;
    if (isNegative !== current.negative) {
      const crossing: Vertex = { x: vertex.x, v: 0 };
      current.vertices.push(crossing);
      runs.push(current);
      current = { negative: isNegative, vertices: [crossing, vertex] };
    } else {
      current.vertices.push(vertex);
    }
  }

  runs.push(current);
  return runs;
}

const BalanceChart: React.FC<BalanceChartProps> = ({ points, ariaLabel, className }) => {
  const model = useMemo(() => {
    if (points.length === 0) {
      return null;
    }

    const values = points.map((point) => point.valueCents);
    // Zero always sits in the domain: "am I above water" is the question this
    // chart exists to answer, so the reference line is never off-screen.
    const dataMin = Math.min(0, ...values);
    const dataMax = Math.max(0, ...values);
    const step = niceStep(dataMax - dataMin || Math.abs(dataMax) || 100, 4);
    const min = Math.floor(dataMin / step) * step;
    const max = Math.ceil(dataMax / step) * step;
    const span = max - min || 1;

    const xAt = (index: number) => (points.length === 1 ? PAD_L + PLOT_W / 2 : PAD_L + (index / (points.length - 1)) * PLOT_W);
    const yAt = (value: number) => PAD_T + ((max - value) / span) * PLOT_H;

    const ticks: number[] = [];
    for (let value = min; value <= max + step / 2; value += step) {
      ticks.push(Math.round(value));
    }

    // One label per month, thinned out so a multi-year range stays legible.
    const monthStarts = points
      .map((point, index) => ({ point, index }))
      .filter(({ point, index }) => index === 0 || point.date.slice(0, 7) !== points[index - 1].date.slice(0, 7));
    const stride = Math.ceil(monthStarts.length / 8) || 1;
    const monthTicks = monthStarts.filter((_, i) => i % stride === 0);

    const vertices = buildVertices(points, xAt);
    const runs = splitBySign(vertices);

    const lowest = points.reduce((acc, point) => (point.valueCents < acc.valueCents ? point : acc), points[0]);
    const lowestIndex = points.indexOf(lowest);

    return { min, max, ticks, monthTicks, runs, xAt, yAt, lowest, lowestIndex };
  }, [points]);

  if (!model) {
    return null;
  }

  const { ticks, monthTicks, runs, xAt, yAt, lowest, lowestIndex } = model;
  const zeroY = yAt(0);

  const toLine = (run: Run) => run.vertices.map((vertex, i) => `${i === 0 ? 'M' : 'L'}${vertex.x.toFixed(1)} ${yAt(vertex.v).toFixed(1)}`).join(' ');
  const toArea = (run: Run) => {
    const first = run.vertices[0];
    const last = run.vertices[run.vertices.length - 1];
    return `${toLine(run)} L${last.x.toFixed(1)} ${zeroY.toFixed(1)} L${first.x.toFixed(1)} ${zeroY.toFixed(1)} Z`;
  };

  return (
    <div className={clsx('rounded-xl border border-rule bg-surface-raised p-4', className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={ariaLabel}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD_L} y1={yAt(tick)} x2={W - PAD_R} y2={yAt(tick)} stroke="var(--rule)" strokeWidth={1} strokeDasharray={tick === 0 ? '3 3' : undefined} />
            <text x={PAD_L - 10} y={yAt(tick) + 4} textAnchor="end" fill="var(--ink-3)" className="font-mono" fontSize={10}>
              {formatCentsAxis(tick)}
            </text>
          </g>
        ))}

        {runs.map((run, i) => (
          <path key={`area-${i}`} d={toArea(run)} fill={run.negative ? 'var(--warn)' : 'var(--accent)'} fillOpacity={run.negative ? 0.14 : 0.1} />
        ))}
        {runs.map((run, i) => (
          <path key={`line-${i}`} d={toLine(run)} fill="none" stroke={run.negative ? 'var(--warn)' : 'var(--accent)'} strokeWidth={2} strokeLinejoin="round" />
        ))}

        <circle cx={xAt(lowestIndex)} cy={yAt(lowest.valueCents)} r={3.5} fill={lowest.valueCents < 0 ? 'var(--warn)' : 'var(--accent)'} />

        {monthTicks.map(({ point, index }) => (
          <text key={point.date} x={xAt(index)} y={H - PAD_B + 22} textAnchor={index === 0 ? 'start' : 'middle'} fill="var(--ink-3)" className="font-mono" fontSize={10}>
            {formatISODate(point.date, 'MMM')}
          </text>
        ))}
      </svg>
    </div>
  );
};

export default BalanceChart;
