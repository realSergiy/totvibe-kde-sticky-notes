// SPDX-License-Identifier: GPL-3.0-or-later
import { rm } from 'node:fs/promises';
import { createNote, createPositionsStore, listNotes } from '../src/core/index.ts';

const target = '/tmp/totvibe-test';
const env = process.env as { XDG_DATA_HOME?: string };
env.XDG_DATA_HOME = target;

await rm(target, { recursive: true, force: true });

const id = await createNote('hello\nfrom playground');
console.info('created', id);

const summaries = await listNotes();
console.info('list', summaries);

const positions = createPositionsStore({ debounceMs: 50 });
await positions.upsert(id, { x: 10, y: 20, width: 240, height: 200 });
await positions.flush();
console.info('positions written');
