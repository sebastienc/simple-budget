import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildGoldenVectors, renderGoldenVectors } from '../../test/golden/generate';

const goldenPath = resolve(__dirname, '../../test/golden/projection.json');

// The mobile app checks its Kotlin port of the engine against this file. If the
// engine's behaviour changes, the file has to change in the same commit, or the
// two apps quietly disagree about someone's balance.
describe('golden vectors for the mobile port', () => {
  it('match what the engine produces today (run `npm run golden` and commit if this fails)', () => {
    expect(JSON.parse(readFileSync(goldenPath, 'utf8'))).toEqual(JSON.parse(JSON.stringify(buildGoldenVectors())));
  });

  it('are byte-for-byte what the generator writes, so reviews see real diffs', () => {
    expect(readFileSync(goldenPath, 'utf8')).toBe(renderGoldenVectors());
  });

  it('include the edge cases that are easy to port wrongly', () => {
    const vectors = buildGoldenVectors();
    const days = vectors.projectBalance.flatMap((c) => c.expected);
    expect(days.some((d) => d.correctionApplied)).toBe(true);
    expect(vectors.projectBalance.some((c) => c.expected.length === 0)).toBe(true);
    expect(vectors.sinkingFundContribution.some((c) => c.expected.nextOccurrenceDate === null)).toBe(true);
    expect(vectors.projectBalance.length).toBeGreaterThanOrEqual(25);
  });
});
