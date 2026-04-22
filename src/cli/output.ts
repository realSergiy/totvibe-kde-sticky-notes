// SPDX-License-Identifier: GPL-3.0-or-later
import type { NoteSummary } from '../core/types.ts';

const ID_COLUMN_WIDTH = 24;

export const formatListHuman = (summaries: readonly NoteSummary[]) =>
  summaries.map((s) => `${s.id.padEnd(ID_COLUMN_WIDTH)}  ${s.firstLine}`).join('\n');

export const formatListJson = (summaries: readonly NoteSummary[]) =>
  JSON.stringify(
    summaries.map((s) => ({
      id: s.id,
      firstLine: s.firstLine,
      mtime: s.mtime.toISOString(),
    })),
  );

export const sortByMtimeDesc = (summaries: readonly NoteSummary[]) =>
  [...summaries].sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
