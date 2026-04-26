// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const isAlive = (pid: number) => {
  if (pid === process.pid) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
};

export const acquire = async (path: string) => {
  await mkdir(dirname(path), { recursive: true });
  try {
    const text = await readFile(path, 'utf8');
    const pid = Number.parseInt(text.trim(), 10);
    if (Number.isFinite(pid) && isAlive(pid)) {
      return false;
    }
  } catch {
    /* no existing file, fall through */
  }
  await writeFile(path, `${process.pid}\n`, 'utf8');
  return true;
};

export const release = async (path: string) => {
  try {
    const text = await readFile(path, 'utf8');
    if (Number.parseInt(text.trim(), 10) === process.pid) {
      await unlink(path);
    }
  } catch {
    /* nothing to release */
  }
};
