// SPDX-License-Identifier: GPL-3.0-or-later
import { type FSWatcher, watch } from 'node:fs';
import { access, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { NoteId } from '../core/types.ts';
import type { WatcherEvent } from './router.ts';

const NOTE_EXT = '.md';
const SAFE_STEM = /^[\w.-]+$/;

const noteIdFromFilename = (filename: string) => {
  if (!filename.endsWith(NOTE_EXT)) {
    return null;
  }
  const stem = filename.slice(0, -NOTE_EXT.length);
  return SAFE_STEM.test(stem) ? (stem as NoteId) : null;
};

export type Watcher = {
  listNoteIds: () => Promise<NoteId[]>;
  onEvent: (handler: (event: WatcherEvent) => void) => void;
  close: () => void;
};

export const createWatcher = (dir: string) => {
  const handlers: Array<(event: WatcherEvent) => void> = [];
  const known = new Set<NoteId>();
  let fsw: FSWatcher | null = null;

  const emit = (event: WatcherEvent) => {
    for (const h of handlers) {
      h(event);
    }
  };

  const scanOnce = async () => {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return [] as NoteId[];
    }
    const ids: NoteId[] = [];
    for (const entry of entries) {
      if (entry.startsWith('.')) {
        continue;
      }
      const id = noteIdFromFilename(entry);
      if (id !== null) {
        ids.push(id);
      }
    }
    return ids;
  };

  const recheck = async (filename: string) => {
    const id = noteIdFromFilename(filename);
    if (id === null) {
      return;
    }
    try {
      await access(join(dir, filename));
      if (!known.has(id)) {
        known.add(id);
        emit({ type: 'add', id });
      }
    } catch {
      if (known.has(id)) {
        known.delete(id);
        emit({ type: 'remove', id });
      }
    }
  };

  fsw = watch(dir, (_event, filename) => {
    if (filename === null) {
      return;
    }
    void recheck(filename);
  });

  const watcher: Watcher = {
    listNoteIds: async () => {
      const ids = await scanOnce();
      for (const id of ids) {
        known.add(id);
      }
      return ids;
    },
    onEvent: (h) => {
      handlers.push(h);
    },
    close: () => {
      fsw?.close();
      fsw = null;
    },
  };
  return watcher;
};
