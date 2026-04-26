// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquire, release } from '../../src/daemon/pidlock.ts';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'totvibe-pidlock-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('pidlock', () => {
  test('acquires when no file exists', async () => {
    const path = join(dir, 'daemon.pid');
    expect(await acquire(path)).toBe(true);
    expect((await readFile(path, 'utf8')).trim()).toBe(String(process.pid));
  });

  test('rejects when another live pid owns the file', async () => {
    const path = join(dir, 'daemon.pid');
    await writeFile(path, `${process.ppid}\n`, 'utf8');
    expect(await acquire(path)).toBe(false);
  });

  test('takes over when file holds an obviously-dead pid', async () => {
    const path = join(dir, 'daemon.pid');
    await writeFile(path, '2147483646\n', 'utf8');
    expect(await acquire(path)).toBe(true);
  });

  test('takes over a stale file that held our own pid', async () => {
    const path = join(dir, 'daemon.pid');
    await writeFile(path, `${process.pid}\n`, 'utf8');
    expect(await acquire(path)).toBe(true);
  });

  test('release removes our file', async () => {
    const path = join(dir, 'daemon.pid');
    await acquire(path);
    await release(path);
    await expect(readFile(path, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
