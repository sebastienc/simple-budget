#!/usr/bin/env node
/**
 * Regenerates test/golden/projection.json: the projection engine's exact
 * output for a fixed set of inputs (test/golden/cases.ts).
 *
 *   npm run golden
 *
 * The mobile app (simple-budget-mobile) ports the engine to Kotlin and checks
 * its port against this file. Run this and commit the result whenever you
 * change electron/main/projection.ts on purpose; a test fails if you forget.
 *
 * Runs TypeScript directly through Node's built-in type stripping (the repo
 * pins Node 24), so there is no build step and the real engine is what runs.
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderGoldenVectors } from '../test/golden/generate.ts';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../test/golden/projection.json');
writeFileSync(out, renderGoldenVectors());
console.log(`Wrote ${out}`);
