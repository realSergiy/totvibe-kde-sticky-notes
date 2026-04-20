// SPDX-License-Identifier: GPL-3.0-or-later
const DEFAULT_MAX = 80;
const ELLIPSIS = '…';
const EMPTY = '(empty)';

const stripMarkdown = (line: string) => {
  let out = line.trim();
  out = out.replace(/^(?:>\s*)+/, '');
  out = out.replace(/^#+\s+/, '');
  out = out.replace(/^[-*+]\s+/, '');
  out = out.replace(/^\d+[.)]\s+/, '');
  out = out.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  out = out.replace(/[*_`~]+/g, '');
  return out.trim();
};

const truncate = (s: string, max: number) => {
  if (max <= 0) {
    return '';
  }
  if (s.length <= max) {
    return s;
  }
  if (max < ELLIPSIS.length) {
    return s.slice(0, max);
  }
  return `${s.slice(0, max - ELLIPSIS.length)}${ELLIPSIS}`;
};

export const summaryLine = (content: string, maxChars: number = DEFAULT_MAX) => {
  for (const raw of content.split('\n')) {
    const stripped = stripMarkdown(raw);
    if (stripped.length > 0) {
      return truncate(stripped, maxChars);
    }
  }
  return truncate(EMPTY, maxChars);
};
