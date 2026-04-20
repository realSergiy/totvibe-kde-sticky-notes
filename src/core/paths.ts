// SPDX-License-Identifier: GPL-3.0-or-later
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { NoteId } from './types.ts';

const APP_DIR = 'totvibe-stickynotes';
const NOTES_SUBDIR = 'notes';
const META_DIR = '.meta';
const POSITIONS_FILE = 'positions.json';

const env = process.env as { XDG_DATA_HOME?: string };

const dataHome = () => env.XDG_DATA_HOME ?? join(homedir(), '.local/share');

export const notesDir = () => join(dataHome(), APP_DIR, NOTES_SUBDIR);

export const positionsFile = () => join(notesDir(), META_DIR, POSITIONS_FILE);

export const noteFilePath = (id: NoteId) => join(notesDir(), `${id}.md`);
