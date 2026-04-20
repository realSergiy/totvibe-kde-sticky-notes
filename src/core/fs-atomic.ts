// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

let counter = 0;

export const atomicWrite = async (target: string, data: string) => {
  const dir = dirname(target);
  await mkdir(dir, { recursive: true });
  counter = (counter + 1) >>> 0;
  const tmp = join(dir, `.${process.pid}-${counter}-${Date.now()}.tmp`);
  await writeFile(tmp, data, 'utf8');
  await rename(tmp, target);
};
