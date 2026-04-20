// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { positionsFile } from '../../src/core/paths.ts';
import { createPositionsStore } from '../../src/core/positions-store.ts';
import type { Geometry, NoteId } from '../../src/core/types.ts';
import { makeSandbox, type Sandbox, sleep } from './_helpers.ts';

let sandbox: Sandbox;

const geom = (n: number) => ({ x: n, y: n, width: 100, height: 100 });

beforeEach(async () => {
  sandbox = await makeSandbox();
});

afterEach(async () => {
  await sandbox.cleanup();
});

describe('createPositionsStore', () => {
  test('returns empty map when file is missing', async () => {
    const store = createPositionsStore();
    expect(await store.load()).toEqual({});
  });

  test('returns empty map and warns on corrupt JSON', async () => {
    const file = positionsFile();
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, '{not json');
    const store = createPositionsStore();
    expect(await store.load()).toEqual({});
  });

  test('debounce coalesces rapid upserts into one write', async () => {
    const store = createPositionsStore({ debounceMs: 100 });
    for (let i = 0; i < 5; i++) {
      await store.upsert(`id-${i}` as NoteId, geom(i));
    }
    expect(existsSync(positionsFile())).toBe(false);
    await store.flush();
    expect(existsSync(positionsFile())).toBe(true);
    const written = JSON.parse(await readFile(positionsFile(), 'utf8')) as Record<string, Geometry>;
    expect(Object.keys(written)).toHaveLength(5);
  });

  test('debounce timer eventually writes without flush', async () => {
    const store = createPositionsStore({ debounceMs: 30 });
    await store.upsert('a' as NoteId, geom(1));
    expect(existsSync(positionsFile())).toBe(false);
    await sleep(80);
    expect(existsSync(positionsFile())).toBe(true);
    await store.flush();
  });

  test('flush writes pending state', async () => {
    const store = createPositionsStore({ debounceMs: 60_000 });
    await store.upsert('a' as NoteId, geom(1));
    await store.flush();
    const written = JSON.parse(await readFile(positionsFile(), 'utf8')) as unknown;
    expect(written).toEqual({ a: geom(1) });
  });

  test('remove deletes from disk after flush', async () => {
    const store = createPositionsStore({ debounceMs: 0 });
    await store.upsert('a' as NoteId, geom(1));
    await store.upsert('b' as NoteId, geom(2));
    await store.flush();
    await store.remove('a' as NoteId);
    await store.flush();
    const written = JSON.parse(await readFile(positionsFile(), 'utf8')) as Record<string, Geometry>;
    expect(Object.keys(written)).toEqual(['b']);
  });

  test('load returns the persisted map across stores', async () => {
    const a = createPositionsStore({ debounceMs: 0 });
    await a.upsert('x' as NoteId, geom(7));
    await a.flush();
    const b = createPositionsStore();
    expect(await b.load()).toEqual({ x: geom(7) });
  });
});
