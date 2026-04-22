// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { runCreate, runDelete, runEdit, runList } from '../../src/cli/commands.ts';
import { notesDir } from '../../src/core/paths.ts';
import { makeSandbox, type Sandbox } from '../core/_helpers.ts';
import { captureIO } from './_helpers.ts';

let sandbox: Sandbox;

beforeEach(async () => {
  sandbox = await makeSandbox();
});

afterEach(async () => {
  await sandbox.cleanup();
});

describe('command functions', () => {
  test('runCreate writes a file and prints the id', async () => {
    const cap = captureIO();
    const code = await runCreate(cap.io, 'hello');
    expect(code).toBe(0);
    const id = cap.stdout().trim();
    expect(id).toMatch(/^\d{4}-\d{2}-\d{2}-\d{6}-[0-9a-f]{4}$/);
    const content = await readFile(`${notesDir()}/${id}.md`, 'utf8');
    expect(content).toBe('hello');
  });

  test('runList prints ids sorted by mtime desc', async () => {
    const cap1 = captureIO();
    await runCreate(cap1.io, 'first');
    const id1 = cap1.stdout().trim();

    await Bun.sleep(10);

    const cap2 = captureIO();
    await runCreate(cap2.io, 'second');
    const id2 = cap2.stdout().trim();

    const capList = captureIO();
    const code = await runList(capList.io, false);
    expect(code).toBe(0);
    const lines = capList.stdout().trimEnd().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]?.startsWith(id2)).toBe(true);
    expect(lines[1]?.startsWith(id1)).toBe(true);
  });

  test('runList with json flag parses as array of summaries', async () => {
    const cap = captureIO();
    await runCreate(cap.io, 'a');
    await runCreate(cap.io, 'b');
    const capList = captureIO();
    await runList(capList.io, true);
    const parsed = JSON.parse(capList.stdout().trim()) as Array<{
      id: string;
      firstLine: string;
      mtime: string;
    }>;
    expect(parsed).toHaveLength(2);
    expect(typeof parsed[0]?.id).toBe('string');
    expect(typeof parsed[0]?.firstLine).toBe('string');
    expect(() => new Date(parsed[0]?.mtime ?? '').toISOString()).not.toThrow();
  });

  test('runList json on empty dir returns []', async () => {
    const cap = captureIO();
    const code = await runList(cap.io, true);
    expect(code).toBe(0);
    expect(JSON.parse(cap.stdout().trim())).toEqual([]);
  });

  test('runDelete removes the file', async () => {
    const cap = captureIO();
    await runCreate(cap.io, 'bye');
    const id = cap.stdout().trim();
    const capDel = captureIO();
    const code = await runDelete(capDel.io, id);
    expect(code).toBe(0);
    const entries = await readdir(notesDir());
    expect(entries.filter((e) => e.endsWith('.md'))).toHaveLength(0);
  });

  test('runDelete unknown id is exit 1 with error on stderr', async () => {
    const cap = captureIO();
    const code = await runDelete(cap.io, 'no-such-id');
    expect(code).toBe(1);
    expect(cap.stderr()).toContain("no note with id 'no-such-id'");
  });

  test('runEdit rewrites content', async () => {
    const cap = captureIO();
    await runCreate(cap.io, 'initial');
    const id = cap.stdout().trim();
    const capEdit = captureIO();
    const code = await runEdit(capEdit.io, id, 'replaced');
    expect(code).toBe(0);
    const content = await readFile(`${notesDir()}/${id}.md`, 'utf8');
    expect(content).toBe('replaced');
  });

  test('runEdit unknown id is exit 1', async () => {
    const cap = captureIO();
    const code = await runEdit(cap.io, 'missing', 'x');
    expect(code).toBe(1);
    expect(cap.stderr()).toContain("no note with id 'missing'");
  });
});
