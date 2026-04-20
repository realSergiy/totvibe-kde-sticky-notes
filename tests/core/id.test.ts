// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, test } from 'bun:test';
import { generateNoteId, idFromFilename, isNoteId } from '../../src/core/id.ts';
import type { NoteId } from '../../src/core/types.ts';

describe('generateNoteId', () => {
  test('round-trips through idFromFilename', () => {
    const id = generateNoteId(new Date(2026, 3, 20, 13, 34, 12), () => 0.5);
    expect(idFromFilename(`${id}.md`)).toBe(id);
  });

  test('produces deterministic id for fixed date and rng', () => {
    const id = generateNoteId(new Date(2026, 3, 20, 13, 34, 12), () => 0.5);
    expect(id).toBe('2026-04-20-133412-8000' as NoteId);
  });

  test('formats single-digit components with leading zeros', () => {
    const id = generateNoteId(new Date(2026, 0, 1, 1, 2, 3), () => 0);
    expect(id).toBe('2026-01-01-010203-0000' as NoteId);
  });

  test('clamps rng output to 4 hex digits', () => {
    const id = generateNoteId(new Date(2026, 0, 1, 0, 0, 0), () => 0.999999);
    expect(id).toMatch(/^2026-01-01-000000-[0-9a-f]{4}$/);
  });
});

describe('isNoteId', () => {
  test('accepts a well-formed id', () => {
    expect(isNoteId('2026-04-20-133412-7f2a')).toBe(true);
  });

  test.each([
    ['empty string', ''],
    ['no hex suffix', '2026-04-20-133412'],
    ['wrong date format', '20260420-133412-7f2a'],
    ['short time', '2026-04-20-13412-7f2a'],
    ['non-hex suffix', '2026-04-20-133412-7f2g'],
    ['extra dot', '2026-04-20-133412-7f2a.'],
    ['trailing extension', '2026-04-20-133412-7f2a.md'],
  ])('rejects %s', (_label, value) => {
    expect(isNoteId(value)).toBe(false);
  });
});

describe('idFromFilename', () => {
  test('returns id for matching .md filename', () => {
    expect(idFromFilename('2026-04-20-133412-7f2a.md')).toBe('2026-04-20-133412-7f2a' as NoteId);
  });

  test.each([
    'foo.md',
    '2026-04-20-133412-7f2a',
    '2026-04-20-133412-7f2a.txt',
    '.2026-04-20-133412-7f2a.md',
    'prefix-2026-04-20-133412-7f2a.md',
  ])('returns null for %s', (value) => {
    expect(idFromFilename(value)).toBeNull();
  });
});
