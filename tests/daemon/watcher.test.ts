// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { NoteId } from '../../src/core/types.ts';
import type { WatcherEvent } from '../../src/daemon/router.ts';
import { createWatcher } from '../../src/daemon/watcher.ts';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'totvibe-watcher-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const waitFor = async (pred: () => boolean, timeoutMs = 2000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pred()) {
      return;
    }
    await sleep(20);
  }
  throw new Error('waitFor: condition never met');
};

describe('createWatcher', () => {
  test('listNoteIds returns existing .md files with safe stems', async () => {
    await writeFile(join(dir, 'groceries.md'), 'eggs');
    await writeFile(join(dir, '2026-04-20-133412-7f2a.md'), 'x');
    await writeFile(join(dir, 'bad name.md'), 'x');
    await writeFile(join(dir, 'not-a-note.txt'), 'x');
    const w = createWatcher(dir);
    const ids = await w.listNoteIds();
    w.close();
    expect(ids).toContain('groceries' as NoteId);
    expect(ids).toContain('2026-04-20-133412-7f2a' as NoteId);
    expect(ids).not.toContain('bad name' as NoteId);
  });

  test('emits add event when a file appears', async () => {
    const events: WatcherEvent[] = [];
    const w = createWatcher(dir);
    w.onEvent((e) => events.push(e));
    await writeFile(join(dir, 'foo.md'), 'hi');
    await waitFor(() => events.some((e) => e.type === 'add'));
    w.close();
    expect(events.some((e) => e.type === 'add' && e.id === ('foo' as NoteId))).toBe(true);
  });

  test('emits remove event when a file disappears', async () => {
    await writeFile(join(dir, 'foo.md'), 'hi');
    const w = createWatcher(dir);
    await w.listNoteIds();
    const events: WatcherEvent[] = [];
    w.onEvent((e) => events.push(e));
    await unlink(join(dir, 'foo.md'));
    await waitFor(() => events.some((e) => e.type === 'remove'));
    w.close();
    expect(events.some((e) => e.type === 'remove' && e.id === ('foo' as NoteId))).toBe(true);
  });
});
