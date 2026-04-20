// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile } from 'node:fs/promises';
import { atomicWrite } from './fs-atomic.ts';
import { positionsFile } from './paths.ts';
import type { Geometry, NoteId, PositionsMap } from './types.ts';

const DEFAULT_DEBOUNCE_MS = 500;
const JSON_INDENT = 2;

export type PositionsStore = {
  load: () => Promise<PositionsMap>;
  upsert: (id: NoteId, geom: Geometry) => Promise<void>;
  remove: (id: NoteId) => Promise<void>;
  flush: () => Promise<void>;
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const createPositionsStore = (opts: { debounceMs?: number } = {}) => {
  const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  let cache: PositionsMap | null = null;
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight = Promise.resolve();

  const ensureLoaded = async () => {
    if (cache !== null) {
      return cache;
    }
    try {
      const text = await readFile(positionsFile(), 'utf8');
      const parsed = JSON.parse(text) as unknown;
      cache = isPlainObject(parsed) ? (parsed as PositionsMap) : {};
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        console.warn(`positions: load failed (${(err as Error).message}); starting empty`);
      }
      cache = {};
    }
    return cache;
  };

  const writeNow = async () => {
    if (cache === null) {
      return;
    }
    const snapshot = JSON.stringify(cache, null, JSON_INDENT);
    dirty = false;
    try {
      await atomicWrite(positionsFile(), snapshot);
    } catch (err) {
      dirty = true;
      console.warn(`positions: write failed (${(err as Error).message})`);
    }
  };

  const armFlush = () => {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      inflight = inflight.then(writeNow, writeNow);
    }, debounceMs);
  };

  return {
    load: ensureLoaded,
    upsert: async (id: NoteId, geom: Geometry) => {
      const map = await ensureLoaded();
      map[id] = geom;
      dirty = true;
      armFlush();
    },
    remove: async (id: NoteId) => {
      const map = await ensureLoaded();
      if (id in map) {
        delete map[id];
        dirty = true;
        armFlush();
      }
    },
    flush: async () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      await inflight;
      if (dirty) {
        inflight = inflight.then(writeNow, writeNow);
        await inflight;
      }
    },
  };
};
