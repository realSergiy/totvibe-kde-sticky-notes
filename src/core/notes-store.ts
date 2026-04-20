// SPDX-License-Identifier: GPL-3.0-or-later
import { readdir, readFile, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWrite } from './fs-atomic.ts';
import { generateNoteId } from './id.ts';
import { noteFilePath, notesDir } from './paths.ts';
import { summaryLine } from './summary.ts';
import type { NoteId, NoteSummary } from './types.ts';

const NOTE_EXT = '.md';

const isMissing = (err: unknown) => (err as NodeJS.ErrnoException).code === 'ENOENT';

export class NoteNotFoundError extends Error {
  override readonly name = 'NoteNotFoundError';
  readonly id: NoteId;
  constructor(id: NoteId) {
    super(`Note not found: ${id}`);
    this.id = id;
  }
}

export const listNotes = async () => {
  const dir = notesDir();
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (err) {
    if (isMissing(err)) {
      return [];
    }
    throw err;
  }
  const summaries: NoteSummary[] = [];
  for (const entry of entries) {
    if (entry.startsWith('.')) {
      continue;
    }
    if (!entry.endsWith(NOTE_EXT)) {
      continue;
    }
    const full = join(dir, entry);
    const st = await stat(full);
    if (!st.isFile()) {
      continue;
    }
    const id = entry.slice(0, -NOTE_EXT.length) as NoteId;
    const content = await readFile(full, 'utf8');
    summaries.push({ id, firstLine: summaryLine(content), mtime: st.mtime });
  }
  return summaries;
};

export const readNote = async (id: NoteId) => {
  try {
    const content = await readFile(noteFilePath(id), 'utf8');
    return { id, content };
  } catch (err) {
    if (isMissing(err)) {
      throw new NoteNotFoundError(id);
    }
    throw err;
  }
};

export const writeNote = async (id: NoteId, content: string) => {
  await atomicWrite(noteFilePath(id), content);
};

export const deleteNote = async (id: NoteId) => {
  try {
    await unlink(noteFilePath(id));
  } catch (err) {
    if (isMissing(err)) {
      throw new NoteNotFoundError(id);
    }
    throw err;
  }
};

export const createNote = async (content: string, now?: Date) => {
  const id = generateNoteId(now);
  await writeNote(id, content);
  return id;
};
