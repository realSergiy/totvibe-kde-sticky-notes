// SPDX-License-Identifier: GPL-3.0-or-later
import type { IO } from '../../src/cli/commands.ts';

export type CapturedIO = IO & {
  readonly stdout: () => string;
  readonly stderr: () => string;
  readonly io: IO;
};

export const captureIO = () => {
  const out: string[] = [];
  const err: string[] = [];
  const io: IO = {
    stdout: (s: string) => {
      out.push(s);
    },
    stderr: (s: string) => {
      err.push(s);
    },
  };
  return {
    io,
    stdout: () => out.join(''),
    stderr: () => err.join(''),
  };
};
