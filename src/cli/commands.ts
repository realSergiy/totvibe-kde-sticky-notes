// SPDX-License-Identifier: GPL-3.0-or-later
import { createNote, deleteNote, listNotes, NoteNotFoundError, writeNote } from '../core/notes-store.ts';
import type { NoteId } from '../core/types.ts';
import { formatListHuman, formatListJson, sortByMtimeDesc } from './output.ts';

export const EXIT_OK = 0;
export const EXIT_USER_ERROR = 1;
export const EXIT_INTERNAL_ERROR = 2;

export type IO = {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
};

const reportInternal = (io: IO, err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  io.stderr(`sticky: ${message}\n`);
  return EXIT_INTERNAL_ERROR;
};

export const runCreate = async (io: IO, text: string) => {
  try {
    const id = await createNote(text);
    io.stdout(`${id}\n`);
    return EXIT_OK;
  } catch (err) {
    return reportInternal(io, err);
  }
};

export const runList = async (io: IO, json: boolean) => {
  try {
    const summaries = sortByMtimeDesc(await listNotes());
    const body = json ? formatListJson(summaries) : formatListHuman(summaries);
    if (body.length > 0) {
      io.stdout(`${body}\n`);
    } else if (json) {
      io.stdout('[]\n');
    }
    return EXIT_OK;
  } catch (err) {
    return reportInternal(io, err);
  }
};

export const runDelete = async (io: IO, id: string) => {
  try {
    await deleteNote(id as NoteId);
    return EXIT_OK;
  } catch (err) {
    if (err instanceof NoteNotFoundError) {
      io.stderr(`sticky: no note with id '${id}'\n`);
      return EXIT_USER_ERROR;
    }
    return reportInternal(io, err);
  }
};

export const runEdit = async (io: IO, id: string, text: string) => {
  try {
    const summaries = await listNotes();
    const exists = summaries.some((s) => s.id === (id as NoteId));
    if (!exists) {
      io.stderr(`sticky: no note with id '${id}'\n`);
      return EXIT_USER_ERROR;
    }
    await writeNote(id as NoteId, text);
    return EXIT_OK;
  } catch (err) {
    return reportInternal(io, err);
  }
};
