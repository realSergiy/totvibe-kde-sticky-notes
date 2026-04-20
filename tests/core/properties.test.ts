// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import * as fc from 'fast-check';
import { positionsFile } from '../../src/core/paths.ts';
import { nextCascadePosition } from '../../src/core/placement.ts';
import { createPositionsStore } from '../../src/core/positions-store.ts';
import { summaryLine } from '../../src/core/summary.ts';
import type { Geometry, NoteId, PositionsMap } from '../../src/core/types.ts';
import { makeSandbox, type Sandbox } from './_helpers.ts';

let sandbox: Sandbox;

beforeEach(async () => {
  sandbox = await makeSandbox();
});

afterEach(async () => {
  await sandbox.cleanup();
});

const geomArb = fc.record<Geometry>({
  x: fc.integer({ min: 0, max: 4000 }),
  y: fc.integer({ min: 0, max: 4000 }),
  width: fc.integer({ min: 50, max: 800 }),
  height: fc.integer({ min: 50, max: 800 }),
});

const opArb = fc.oneof(
  fc.record({
    kind: fc.constant('upsert' as const),
    id: fc.stringMatching(/^[a-z0-9]{1,6}$/),
    geom: geomArb,
  }),
  fc.record({
    kind: fc.constant('remove' as const),
    id: fc.stringMatching(/^[a-z0-9]{1,6}$/),
  }),
);

describe('property: positions-store', () => {
  test('after flush, on-disk state matches in-memory state', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(opArb, { maxLength: 30 }), async (ops) => {
        await sandbox.cleanup();
        sandbox = await makeSandbox();
        const store = createPositionsStore({ debounceMs: 0 });
        const expected: PositionsMap = {};
        for (const op of ops) {
          if (op.kind === 'upsert') {
            await store.upsert(op.id as NoteId, op.geom);
            expected[op.id] = op.geom;
          } else {
            await store.remove(op.id as NoteId);
            delete expected[op.id];
          }
        }
        await store.flush();
        const actual =
          Object.keys(expected).length === 0
            ? await store.load()
            : (JSON.parse(await readFile(positionsFile(), 'utf8')) as PositionsMap);
        expect(actual).toEqual(expected);
      }),
      { numRuns: 30 },
    );
  });
});

describe('property: nextCascadePosition', () => {
  test('returns a free origin or wraps to (0,0)', () => {
    fc.assert(
      fc.property(fc.array(geomArb, { maxLength: 20 }), (taken) => {
        const result = nextCascadePosition(taken, { width: 1920, height: 1080 });
        const collides = taken.some((t) => t.x === result.x && t.y === result.y);
        expect(collides ? result.x === 0 && result.y === 0 : true).toBe(true);
      }),
    );
  });
});

describe('property: summaryLine', () => {
  test('result length never exceeds maxChars and contains no newline', () => {
    fc.assert(
      fc.property(fc.string(), fc.integer({ min: 8, max: 200 }), (text, max) => {
        const out = summaryLine(text, max);
        expect(out.length).toBeLessThanOrEqual(max);
        expect(out.includes('\n')).toBe(false);
      }),
    );
  });
});
