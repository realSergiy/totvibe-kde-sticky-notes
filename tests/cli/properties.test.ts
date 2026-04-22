// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, beforeEach, test } from 'bun:test';
import * as fc from 'fast-check';
import { runCreate, runDelete, runEdit, runList } from '../../src/cli/commands.ts';
import { makeSandbox, type Sandbox } from '../core/_helpers.ts';
import { captureIO } from './_helpers.ts';

let sandbox: Sandbox;

beforeEach(async () => {
  sandbox = await makeSandbox();
});

afterEach(async () => {
  await sandbox.cleanup();
});

type Op =
  | { kind: 'create'; text: string }
  | { kind: 'delete'; index: number }
  | { kind: 'edit'; index: number; text: string };

const opArb = fc.oneof(
  fc.record({
    kind: fc.constant('create' as const),
    text: fc.string({ minLength: 1, maxLength: 40 }),
  }),
  fc.record({
    kind: fc.constant('delete' as const),
    index: fc.nat(10),
  }),
  fc.record({
    kind: fc.constant('edit' as const),
    index: fc.nat(10),
    text: fc.string({ minLength: 1, maxLength: 40 }),
  }),
);

const readList = async () => {
  const cap = captureIO();
  const code = await runList(cap.io, true);
  if (code !== 0) {
    throw new Error(`list failed with exit ${code}: ${cap.stderr()}`);
  }
  return JSON.parse(cap.stdout().trim()) as Array<{
    id: string;
    firstLine: string;
    mtime: string;
  }>;
};

const doOp = async (op: Op, ids: string[], contents: Map<string, string>) => {
  if (op.kind === 'create') {
    const cap = captureIO();
    const code = await runCreate(cap.io, op.text);
    if (code !== 0) {
      return;
    }
    const id = cap.stdout().trim();
    ids.push(id);
    contents.set(id, op.text);
    return;
  }
  if (ids.length === 0) {
    return;
  }
  const target = ids[op.index % ids.length];
  if (target === undefined) {
    return;
  }
  if (op.kind === 'delete') {
    const cap = captureIO();
    const code = await runDelete(cap.io, target);
    if (code === 0) {
      const idx = ids.indexOf(target);
      if (idx >= 0) {
        ids.splice(idx, 1);
      }
      contents.delete(target);
    }
    return;
  }
  const cap = captureIO();
  const code = await runEdit(cap.io, target, op.text);
  if (code === 0) {
    contents.set(target, op.text);
  }
};

test('list reflects the sequence of create/delete/edit operations', async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(opArb, { minLength: 0, maxLength: 15 }), async (ops) => {
      await sandbox.cleanup();
      sandbox = await makeSandbox();

      const ids: string[] = [];
      const contents = new Map<string, string>();
      for (const op of ops) {
        await doOp(op, ids, contents);
      }

      const listed = await readList();
      const listedIds = new Set(listed.map((s) => s.id));
      const expectedIds = new Set(contents.keys());
      if (listedIds.size !== expectedIds.size) {
        return false;
      }
      for (const id of expectedIds) {
        if (!listedIds.has(id)) {
          return false;
        }
      }
      return true;
    }),
    { numRuns: 30 },
  );
});
