// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { readdir, writeFile } from 'node:fs/promises';
import {
  createNote,
  deleteNote,
  listNotes,
  NoteNotFoundError,
  readNote,
  writeNote,
} from '../../src/core/notes-store.ts';
import { notesDir } from '../../src/core/paths.ts';
import type { NoteId } from '../../src/core/types.ts';
import { makeSandbox, type Sandbox } from './_helpers.ts';

let sandbox: Sandbox;

beforeEach(async () => {
  sandbox = await makeSandbox();
});

afterEach(async () => {
  await sandbox.cleanup();
});

describe('listNotes', () => {
  test('returns empty array when notes dir is missing', async () => {
    expect(await listNotes()).toEqual([]);
  });

  test('round-trips create → list → read', async () => {
    const id = await createNote('# Hello\nbody');
    const summaries = await listNotes();
    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.id).toBe(id);
    expect(summaries[0]?.firstLine).toBe('Hello');
    const note = await readNote(id);
    expect(note.content).toBe('# Hello\nbody');
  });

  test('skips dotfiles and the .meta directory', async () => {
    await createNote('a');
    await writeFile(`${notesDir()}/.hidden.md`, 'x');
    const entries = await readdir(notesDir());
    expect(entries).toContain('.hidden.md');
    const summaries = await listNotes();
    expect(summaries).toHaveLength(1);
  });

  test('accepts foreign-named .md files', async () => {
    await createNote('a');
    await writeFile(`${notesDir()}/groceries.md`, '- eggs');
    const summaries = await listNotes();
    expect(summaries).toHaveLength(2);
    const foreign = summaries.find((s) => s.id === ('groceries' as NoteId));
    expect(foreign?.firstLine).toBe('eggs');
  });
});

describe('deleteNote', () => {
  test('removes the file', async () => {
    const id = await createNote('a');
    await deleteNote(id);
    expect(await listNotes()).toEqual([]);
  });

  test('throws NoteNotFoundError when reading after delete', async () => {
    const id = await createNote('a');
    await deleteNote(id);
    await expect(readNote(id)).rejects.toBeInstanceOf(NoteNotFoundError);
  });

  test('throws NoteNotFoundError when deleting unknown id', async () => {
    await expect(deleteNote('missing' as NoteId)).rejects.toBeInstanceOf(NoteNotFoundError);
  });
});

describe('writeNote', () => {
  test('leaves no .tmp files behind', async () => {
    const id = await createNote('a');
    await writeNote(id, 'updated');
    const entries = await readdir(notesDir());
    expect(entries.some((e) => e.endsWith('.tmp'))).toBe(false);
  });

  test('overwrites existing content atomically', async () => {
    const id = await createNote('first');
    await writeNote(id, 'second');
    expect((await readNote(id)).content).toBe('second');
  });
});
