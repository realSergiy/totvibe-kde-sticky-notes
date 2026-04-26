// SPDX-License-Identifier: GPL-3.0-or-later
import { spawn } from 'bun';
import { buildDespawnSnippet, buildReconcileSnippet, buildSpawnSnippet } from './dbus-plasmashell-snippets.ts';
import type { Geometry, NoteId } from './types.ts';

const DBUS_SERVICE = 'org.kde.plasmashell';
const DBUS_PATH = '/PlasmaShell';
const DBUS_METHOD = 'org.kde.PlasmaShell.evaluateScript';
const DEFAULT_BIN = 'qdbus6';

export type PlasmashellClient = {
  evaluateScript: (qml: string) => Promise<string>;
  spawnSticky: (noteId: NoteId, geom: Geometry) => Promise<void>;
  despawnSticky: (noteId: NoteId) => Promise<void>;
  reconcile: (validIds: readonly NoteId[]) => Promise<void>;
};

export type PlasmashellClientOptions = { bin?: string };

export const createPlasmashellClient = (opts: PlasmashellClientOptions = {}) => {
  const bin = opts.bin ?? DEFAULT_BIN;
  const evaluateScript = async (qml: string) => {
    const proc = spawn([bin, DBUS_SERVICE, DBUS_PATH, DBUS_METHOD, qml], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (code !== 0) {
      const msg = stderr.trim() || stdout.trim() || `exit ${code}`;
      throw new Error(`plasmashell.evaluateScript failed: ${msg}`);
    }
    return stdout;
  };
  const client: PlasmashellClient = {
    evaluateScript,
    spawnSticky: async (id, geom) => {
      await evaluateScript(buildSpawnSnippet(id, geom));
    },
    despawnSticky: async (id) => {
      await evaluateScript(buildDespawnSnippet(id));
    },
    reconcile: async (validIds) => {
      await evaluateScript(buildReconcileSnippet(validIds));
    },
  };
  return client;
};
