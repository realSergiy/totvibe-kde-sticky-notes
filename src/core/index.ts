// SPDX-License-Identifier: GPL-3.0-or-later
export {
  createPlasmashellClient,
  type PlasmashellClient,
  type PlasmashellClientOptions,
} from './dbus-plasmashell.ts';
export { generateNoteId, idFromFilename, isNoteId } from './id.ts';
export {
  createNote,
  deleteNote,
  listNotes,
  NoteNotFoundError,
  readNote,
  writeNote,
} from './notes-store.ts';
export { noteFilePath, notesDir, positionsFile } from './paths.ts';
export { clampToScreen, nextCascadePosition } from './placement.ts';
export { createPositionsStore, type PositionsStore } from './positions-store.ts';
export { summaryLine } from './summary.ts';
export type { Geometry, Note, NoteId, NoteSummary, PositionsMap } from './types.ts';
