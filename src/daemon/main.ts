// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createPlasmashellClient, type PlasmashellClient } from '../core/dbus-plasmashell.ts';
import { notesDir } from '../core/paths.ts';
import { nextCascadePosition } from '../core/placement.ts';
import { createPositionsStore, type PositionsStore } from '../core/positions-store.ts';
import type { NoteId } from '../core/types.ts';
import { acquire, release } from './pidlock.ts';
import { type Op, routeEvent } from './router.ts';
import { createWatcher, type Watcher } from './watcher.ts';

const DEFAULT_SCREEN = { width: 1920, height: 1080 };
const STATE_DIR = '.local/state/totvibe-stickynotes';
const PID_FILE = 'daemon.pid';

const stateDir = () => {
  const env = process.env as { XDG_STATE_HOME?: string };
  return env.XDG_STATE_HOME ?? join(homedir(), STATE_DIR);
};

const pidFile = () => join(stateDir(), PID_FILE);

const pickGeometry = async (id: NoteId, positions: PositionsStore) => {
  const map = await positions.load();
  const existing = map[id];
  if (existing) {
    return existing;
  }
  const taken = Object.values(map);
  return nextCascadePosition(taken, DEFAULT_SCREEN);
};

const apply = async (op: Op, client: PlasmashellClient, positions: PositionsStore) => {
  try {
    if (op.type === 'spawn') {
      const geom = await pickGeometry(op.id, positions);
      await client.spawnSticky(op.id, geom);
      console.info(`sticky-watcherd: spawn ${op.id}`);
    } else {
      await client.despawnSticky(op.id);
      console.info(`sticky-watcherd: despawn ${op.id}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`sticky-watcherd: ${op.type} ${op.id} failed: ${msg}`);
  }
};

type RunDeps = {
  watcher: Watcher;
  client: PlasmashellClient;
  positions: PositionsStore;
};

export const startLoop = async ({ watcher, client, positions }: RunDeps) => {
  const files = await watcher.listNoteIds();
  try {
    await client.reconcile(files);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`sticky-watcherd: reconcile failed: ${msg}`);
  }
  for (const id of files) {
    await apply({ type: 'spawn', id }, client, positions);
  }
  watcher.onEvent((event) => {
    void apply(routeEvent(event), client, positions);
  });
};

const installSignalHandlers = (onStop: () => void) => {
  const handle = () => {
    onStop();
  };
  process.on('SIGINT', handle);
  process.on('SIGTERM', handle);
  process.on('SIGHUP', handle);
};

const main = async () => {
  await mkdir(notesDir(), { recursive: true });
  const lock = pidFile();
  const acquired = await acquire(lock);
  if (!acquired) {
    console.info('sticky-watcherd: another instance is running; exiting');
    return 0;
  }

  const watcher = createWatcher(notesDir());
  const client = createPlasmashellClient();
  const positions = createPositionsStore();

  let stopping = false;
  const stop = async () => {
    if (stopping) {
      return;
    }
    stopping = true;
    watcher.close();
    await positions.flush();
    await release(lock);
    process.exit(0);
  };
  installSignalHandlers(() => {
    void stop();
  });

  await startLoop({ watcher, client, positions });
  console.info(`sticky-watcherd: watching ${notesDir()}`);
  return new Promise<number>(() => {
    /* keep process alive until a signal */
  });
};

if (import.meta.main) {
  const code = await main();
  process.exit(code);
}
