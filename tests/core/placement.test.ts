// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, test } from 'bun:test';
import { clampToScreen, nextCascadePosition } from '../../src/core/placement.ts';
import type { Geometry } from '../../src/core/types.ts';

const SCREEN = { width: 1920, height: 1080 };
const DEFAULTS = { width: 240, height: 200, offset: 30 };

describe('nextCascadePosition', () => {
  test('returns origin for empty taken', () => {
    expect(nextCascadePosition([], SCREEN, DEFAULTS)).toEqual({ x: 0, y: 0, ...{ width: 240, height: 200 } });
  });

  test('offsets when origin is taken', () => {
    const taken: Geometry[] = [{ x: 0, y: 0, width: 240, height: 200 }];
    expect(nextCascadePosition(taken, SCREEN, DEFAULTS)).toMatchObject({ x: 30, y: 30 });
  });

  test('cascades multiple notes', () => {
    const taken: Geometry[] = [];
    for (let i = 0; i < 4; i++) {
      const next = nextCascadePosition(taken, SCREEN, DEFAULTS);
      taken.push(next);
    }
    expect(taken.map((g) => g.x)).toEqual([0, 30, 60, 90]);
    expect(taken.map((g) => g.y)).toEqual([0, 30, 60, 90]);
  });

  test('wraps to origin when next position would exceed screen', () => {
    const small = { width: 250, height: 250 };
    const taken: Geometry[] = [{ x: 0, y: 0, width: 240, height: 200 }];
    const next = nextCascadePosition(taken, small, DEFAULTS);
    expect(next).toEqual({ x: 0, y: 0, width: 240, height: 200 });
  });
});

describe('clampToScreen', () => {
  test('keeps in-bounds geometry unchanged', () => {
    const g: Geometry = { x: 100, y: 100, width: 240, height: 200 };
    expect(clampToScreen(g, SCREEN)).toEqual(g);
  });

  test('clamps off-screen positive coordinates back inside', () => {
    const g: Geometry = { x: 99999, y: 99999, width: 240, height: 200 };
    expect(clampToScreen(g, SCREEN)).toEqual({ x: 1680, y: 880, width: 240, height: 200 });
  });

  test('clamps negative coordinates to zero', () => {
    const g: Geometry = { x: -50, y: -50, width: 240, height: 200 };
    expect(clampToScreen(g, SCREEN)).toEqual({ x: 0, y: 0, width: 240, height: 200 });
  });

  test('handles geometry larger than screen by anchoring at origin', () => {
    const g: Geometry = { x: 0, y: 0, width: 5000, height: 5000 };
    expect(clampToScreen(g, SCREEN)).toEqual({ x: 0, y: 0, width: 5000, height: 5000 });
  });
});
