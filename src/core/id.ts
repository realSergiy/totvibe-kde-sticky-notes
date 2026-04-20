// SPDX-License-Identifier: GPL-3.0-or-later
import type { NoteId } from './types.ts';

const ID_REGEX = /^\d{4}-\d{2}-\d{2}-\d{6}-[0-9a-f]{4}$/;
const FILENAME_REGEX = /^\d{4}-\d{2}-\d{2}-\d{6}-[0-9a-f]{4}\.md$/;
const RAND_RANGE = 0x10000;
const HEX_WIDTH = 4;

const pad = (n: number, width: number) => n.toString().padStart(width, '0');

const formatTimestamp = (d: Date) => {
  const yyyy = pad(d.getFullYear(), 4);
  const mm = pad(d.getMonth() + 1, 2);
  const dd = pad(d.getDate(), 2);
  const hh = pad(d.getHours(), 2);
  const mi = pad(d.getMinutes(), 2);
  const ss = pad(d.getSeconds(), 2);
  return `${yyyy}-${mm}-${dd}-${hh}${mi}${ss}`;
};

const randomHex = (rng: () => number) => {
  const value = Math.floor(rng() * RAND_RANGE) % RAND_RANGE;
  return value.toString(16).padStart(HEX_WIDTH, '0');
};

export const generateNoteId = (now: Date = new Date(), rng: () => number = Math.random) =>
  `${formatTimestamp(now)}-${randomHex(rng)}` as NoteId;

export const isNoteId = (s: string): s is NoteId => ID_REGEX.test(s);

export const idFromFilename = (filename: string) => {
  if (!FILENAME_REGEX.test(filename)) {
    return null;
  }
  return filename.slice(0, -'.md'.length) as NoteId;
};
