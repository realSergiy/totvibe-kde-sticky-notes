// SPDX-License-Identifier: GPL-3.0-or-later
import type { NoteId } from '../core/types.ts';

export type WatcherEvent = { type: 'add'; id: NoteId } | { type: 'remove'; id: NoteId };

export type Op = { type: 'spawn'; id: NoteId } | { type: 'despawn'; id: NoteId };

export const routeEvent = (event: WatcherEvent) =>
  event.type === 'add' ? ({ type: 'spawn', id: event.id } as const) : ({ type: 'despawn', id: event.id } as const);

export const reconcile = (files: readonly NoteId[], applets: readonly NoteId[]) => {
  const fileSet = new Set<NoteId>(files);
  const appletSet = new Set<NoteId>(applets);
  const ops: Op[] = [];
  for (const id of files) {
    if (!appletSet.has(id)) {
      ops.push({ type: 'spawn', id });
    }
  }
  for (const id of applets) {
    if (!fileSet.has(id)) {
      ops.push({ type: 'despawn', id });
    }
  }
  return ops;
};
