import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BalanceChart, { buildVertices, niceStep, splitBySign } from './BalanceChart';
import type { BalancePoint } from './BalanceChart';

describe('niceStep', () => {
  it('returns 1 for a non-positive range', () => {
    expect(niceStep(0, 4)).toBe(1);
    expect(niceStep(-10, 4)).toBe(1);
  });

  it('snaps to a 1/2/2.5/5/10 × 10ⁿ step near range/targetTicks', () => {
    // 1000/4 = 250 → nearest nice step at that magnitude is 250 itself (2.5 × 100).
    expect(niceStep(1000, 4)).toBe(250);
    // 900/4 = 225 → normalized 2.25 rounds up to the 2.5 bucket → 250.
    expect(niceStep(900, 4)).toBe(250);
    // 400/4 = 100 → exactly a power of ten.
    expect(niceStep(400, 4)).toBe(100);
  });
});

describe('buildVertices', () => {
  const xAt = (index: number) => index * 10;

  it('starts at the first point\'s own value', () => {
    const points: BalancePoint[] = [{ date: '2026-01-01', valueCents: 100 }];
    expect(buildVertices(points, xAt)).toEqual([{ x: 0, v: 100 }]);
  });

  it('draws a horizontal run at the previous value, then a vertical jump to the new one', () => {
    const points: BalancePoint[] = [
      { date: '2026-01-01', valueCents: 100 },
      { date: '2026-01-02', valueCents: 300 },
    ];
    expect(buildVertices(points, xAt)).toEqual([
      { x: 0, v: 100 },
      { x: 10, v: 100 }, // holds the previous value up to the new x...
      { x: 10, v: 300 }, // ...then jumps vertically to the new one.
    ]);
  });
});

describe('splitBySign', () => {
  it('keeps a single run when every vertex shares a sign', () => {
    const vertices = [{ x: 0, v: 100 }, { x: 10, v: 100 }, { x: 10, v: 200 }];
    const runs = splitBySign(vertices);
    expect(runs).toHaveLength(1);
    expect(runs[0].negative).toBe(false);
  });

  it('inserts a zero-crossing vertex exactly at the sign change, on the vertical segment\'s x', () => {
    const vertices = [
      { x: 0, v: 100 },
      { x: 10, v: 100 },
      { x: 10, v: -50 }, // the vertical jump that crosses zero
    ];
    const runs = splitBySign(vertices);

    expect(runs).toHaveLength(2);
    expect(runs[0]).toEqual({ negative: false, vertices: [{ x: 0, v: 100 }, { x: 10, v: 100 }, { x: 10, v: 0 }] });
    expect(runs[1]).toEqual({ negative: true, vertices: [{ x: 10, v: 0 }, { x: 10, v: -50 }] });
  });
});

describe('BalanceChart', () => {
  const points: BalancePoint[] = [
    { date: '2026-01-01', valueCents: 10_000 },
    { date: '2026-01-02', valueCents: -5_000 },
    { date: '2026-01-03', valueCents: 2_000 },
  ];

  it('renders nothing when there are no points', () => {
    const { container } = render(<BalanceChart points={[]} currency="CAD" ariaLabel="Balance" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an accessible SVG with the given label', () => {
    render(<BalanceChart points={points} currency="CAD" ariaLabel="Chequing balance" />);
    expect(screen.getByRole('img', { name: 'Chequing balance' })).toBeInTheDocument();
  });

  it('shows a tooltip with the hovered date and balance on mousemove, and hides it on mouseleave', () => {
    render(<BalanceChart points={points} currency="CAD" ariaLabel="Balance" />);
    const svg = screen.getByRole('img');
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 720, height: 236, right: 720, bottom: 236, x: 0, y: 0, toJSON: () => {} });

    // x = 0 maps to the leftmost plotted index (the chart's left padding
    // absorbs anything before it), so this lands on the first point.
    fireEvent.mouseMove(svg, { clientX: 0, clientY: 0 });
    expect(screen.getByText('1 Jan 2026')).toBeInTheDocument();
    expect(screen.getByText('CA$100.00')).toBeInTheDocument();

    fireEvent.mouseLeave(svg);
    expect(screen.queryByText('1 Jan 2026')).not.toBeInTheDocument();
  });
});
