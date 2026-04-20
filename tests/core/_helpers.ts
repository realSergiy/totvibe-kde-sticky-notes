// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type Sandbox = { dir: string; cleanup: () => Promise<void> };

const env = process.env as { XDG_DATA_HOME?: string };

export const makeSandbox = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'totvibe-test-'));
  env.XDG_DATA_HOME = dir;
  return {
    dir,
    cleanup: async () => {
      delete env.XDG_DATA_HOME;
      await rm(dir, { recursive: true, force: true });
    },
  };
};

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
