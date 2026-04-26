// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, test } from 'bun:test';
import {
  buildDespawnSnippet,
  buildReconcileSnippet,
  buildSpawnSnippet,
  PLASMASHELL_PLUGIN_ID,
} from '../../src/core/dbus-plasmashell-snippets.ts';
import type { NoteId } from '../../src/core/types.ts';

const SAFE_ID = '2026-04-20-133412-7f2a' as NoteId;
const HAND_ID = 'groceries' as NoteId;

describe('buildSpawnSnippet', () => {
  test('embeds plugin id, note id, and integer coordinates', () => {
    const snippet = buildSpawnSnippet(SAFE_ID, { x: 10.4, y: 20.6, width: 240, height: 200 });
    expect(snippet).toContain(PLASMASHELL_PLUGIN_ID);
    expect(snippet).toContain(`"${SAFE_ID}"`);
    expect(snippet).toContain('addWidget("com.totvibe.stickynotes", 10, 21, 240, 200)');
  });

  test('accepts hand-named ids that match the safe regex', () => {
    expect(() => buildSpawnSnippet(HAND_ID, { x: 0, y: 0, width: 240, height: 200 })).not.toThrow();
  });

  test.each([
    ["'); doSomethingNasty(); //"],
    ['foo"bar'],
    ['foo bar'],
    ['foo/bar'],
    ['foo\\bar'],
    ['foo\nbar'],
    ['../etc/passwd'],
    [''],
  ])('rejects unsafe id %p', (evil) => {
    expect(() => buildSpawnSnippet(evil as NoteId, { x: 0, y: 0, width: 240, height: 200 })).toThrow();
  });

  test.each([
    [Number.NaN],
    [Number.POSITIVE_INFINITY],
    [Number.NEGATIVE_INFINITY],
  ])('rejects non-finite coordinate %p', (n) => {
    expect(() => buildSpawnSnippet(SAFE_ID, { x: n, y: 0, width: 240, height: 200 })).toThrow();
  });
});

describe('buildDespawnSnippet', () => {
  test('embeds plugin id and note id', () => {
    const snippet = buildDespawnSnippet(SAFE_ID);
    expect(snippet).toContain(PLASMASHELL_PLUGIN_ID);
    expect(snippet).toContain(`"${SAFE_ID}"`);
    expect(snippet).toContain('a.remove()');
  });

  test('rejects malicious ids', () => {
    expect(() => buildDespawnSnippet("'); doSomethingNasty(); //" as NoteId)).toThrow();
  });
});

describe('buildReconcileSnippet', () => {
  test('lists all valid ids as a JS array', () => {
    const snippet = buildReconcileSnippet([SAFE_ID, HAND_ID]);
    expect(snippet).toContain(`"${SAFE_ID}"`);
    expect(snippet).toContain(`"${HAND_ID}"`);
    expect(snippet).toContain('valid = [');
  });

  test('empty list is allowed', () => {
    const snippet = buildReconcileSnippet([]);
    expect(snippet).toContain('valid = [];');
  });

  test('rejects the entire batch if any id is unsafe', () => {
    expect(() => buildReconcileSnippet([SAFE_ID, 'bad id' as NoteId])).toThrow();
  });
});
