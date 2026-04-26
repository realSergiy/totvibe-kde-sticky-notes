// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, test } from 'bun:test';
import type { NoteId } from '../../src/core/types.ts';
import { reconcile, routeEvent } from '../../src/daemon/router.ts';

const A = 'a' as NoteId;
const B = 'b' as NoteId;
const C = 'c' as NoteId;

describe('routeEvent', () => {
  test('add → spawn', () => {
    expect(routeEvent({ type: 'add', id: A })).toEqual({ type: 'spawn', id: A });
  });

  test('remove → despawn', () => {
    expect(routeEvent({ type: 'remove', id: A })).toEqual({ type: 'despawn', id: A });
  });
});

describe('reconcile', () => {
  test('spawns files without applets', () => {
    expect(reconcile([A, B], [])).toEqual([
      { type: 'spawn', id: A },
      { type: 'spawn', id: B },
    ]);
  });

  test('despawns applets without files', () => {
    expect(reconcile([], [A, B])).toEqual([
      { type: 'despawn', id: A },
      { type: 'despawn', id: B },
    ]);
  });

  test('no-op when sets match', () => {
    expect(reconcile([A, B], [B, A])).toEqual([]);
  });

  test('mixed: spawn missing + despawn stale', () => {
    expect(reconcile([A, B], [B, C])).toEqual([
      { type: 'spawn', id: A },
      { type: 'despawn', id: C },
    ]);
  });
});
