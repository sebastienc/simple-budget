import { afterEach, describe, expect, it, vi } from 'vitest';
import { notifyBudgetChanged, onBudgetChanged } from './changes';

const stops: (() => void)[] = [];
const listen = (listener: () => void) => {
  const stop = onBudgetChanged(listener);
  stops.push(stop);
  return stop;
};

afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
  vi.restoreAllMocks();
});

describe('budget changes', () => {
  it('are told to everyone listening, and to nobody who stopped', () => {
    const a = vi.fn();
    const b = vi.fn();
    listen(a);
    const stopB = listen(b);
    notifyBudgetChanged();
    stopB();
    notifyBudgetChanged();
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('do nothing when nobody listens', () => {
    expect(() => notifyBudgetChanged()).not.toThrow();
  });

  it('are not held up by a listener that throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const after = vi.fn();
    listen(() => {
      throw new Error('no');
    });
    listen(after);
    expect(() => notifyBudgetChanged()).not.toThrow();
    expect(after).toHaveBeenCalledTimes(1);
  });
});
