// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, test } from 'bun:test';
import { summaryLine } from '../../src/core/summary.ts';

describe('summaryLine', () => {
  test('returns the first non-empty line', () => {
    expect(summaryLine('\n\nHello world\nsecond')).toBe('Hello world');
  });

  test.each([
    ['heading', '# Title here', 'Title here'],
    ['multi-hash heading', '### Sub title', 'Sub title'],
    ['list dash', '- buy milk', 'buy milk'],
    ['list star', '* buy milk', 'buy milk'],
    ['list plus', '+ buy milk', 'buy milk'],
    ['ordered list dot', '1. buy milk', 'buy milk'],
    ['ordered list paren', '2) buy milk', 'buy milk'],
    ['blockquote', '> quoted text', 'quoted text'],
    ['nested blockquote', '> > nested', 'nested'],
    ['link', '[click here](https://example.com)', 'click here'],
    ['emphasis', '**bold** _ital_ `code` ~strike~', 'bold ital code strike'],
  ])('strips %s', (_label, input, expected) => {
    expect(summaryLine(input)).toBe(expected);
  });

  test('returns "(empty)" for empty input', () => {
    expect(summaryLine('')).toBe('(empty)');
  });

  test('returns "(empty)" for whitespace-only input', () => {
    expect(summaryLine('  \n\t\n   ')).toBe('(empty)');
  });

  test('truncates with ellipsis at maxChars', () => {
    const out = summaryLine('a'.repeat(100), 10);
    expect(out).toHaveLength(10);
    expect(out.endsWith('…')).toBe(true);
  });

  test('does not truncate when within limit', () => {
    expect(summaryLine('short', 80)).toBe('short');
  });

  test('handles maxChars smaller than ellipsis', () => {
    const out = summaryLine('long string', 0);
    expect(out).toBe('');
  });
});
