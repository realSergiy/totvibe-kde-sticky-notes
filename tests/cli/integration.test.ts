// SPDX-License-Identifier: GPL-3.0-or-later
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dir, '../..');
const BINARY = join(REPO_ROOT, 'dist', 'sticky');

const hasBinary = async () => {
  try {
    await access(BINARY);
    return true;
  } catch {
    return false;
  }
};

let binaryAvailable = false;
let sandbox: string;

beforeAll(async () => {
  binaryAvailable = await hasBinary();
  if (!binaryAvailable) {
    console.warn(`[integration] dist/sticky not found — skipping spawn tests. Run 'bun run build:cli' first.`);
  }
});

afterAll(() => {});

beforeEach(async () => {
  sandbox = await mkdtemp(join(tmpdir(), 'totvibe-int-'));
});

afterEach(async () => {
  await rm(sandbox, { recursive: true, force: true });
});

const spawnCli = async (args: readonly string[], stdin?: string) => {
  const proc = Bun.spawn([BINARY, ...args], {
    env: { ...process.env, XDG_DATA_HOME: sandbox },
    stdin: stdin === undefined ? 'ignore' : 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (stdin !== undefined && proc.stdin !== undefined) {
    proc.stdin.write(stdin);
    await proc.stdin.end();
  }
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
};

const notesPath = () => join(sandbox, 'totvibe-stickynotes', 'notes');

describe('sticky binary', () => {
  test('create → file appears, stdout is new id', async () => {
    if (!binaryAvailable) {
      return;
    }
    const r = await spawnCli(['create', 'hello']);
    expect(r.exitCode).toBe(0);
    const id = r.stdout.trim();
    expect(id).toMatch(/^\d{4}-\d{2}-\d{2}-\d{6}-[0-9a-f]{4}$/);
    const content = await readFile(join(notesPath(), `${id}.md`), 'utf8');
    expect(content).toBe('hello');
  });

  test('list shows 3 notes sorted by mtime desc', async () => {
    if (!binaryAvailable) {
      return;
    }
    await spawnCli(['create', 'first']);
    await Bun.sleep(10);
    await spawnCli(['create', 'second']);
    await Bun.sleep(10);
    await spawnCli(['create', 'third']);
    const r = await spawnCli(['list']);
    expect(r.exitCode).toBe(0);
    const lines = r.stdout.trimEnd().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('third');
    expect(lines[2]).toContain('first');
  });

  test('list --json parses as JSON array of length 3', async () => {
    if (!binaryAvailable) {
      return;
    }
    await spawnCli(['create', 'a']);
    await spawnCli(['create', 'b']);
    await spawnCli(['create', 'c']);
    const r = await spawnCli(['list', '--json']);
    expect(r.exitCode).toBe(0);
    const parsed = JSON.parse(r.stdout.trim()) as unknown;
    expect(Array.isArray(parsed)).toBe(true);
    expect((parsed as unknown[]).length).toBe(3);
  });

  test('delete removes the file', async () => {
    if (!binaryAvailable) {
      return;
    }
    const r1 = await spawnCli(['create', 'bye']);
    const id = r1.stdout.trim();
    const r2 = await spawnCli(['delete', id]);
    expect(r2.exitCode).toBe(0);
    await expect(readFile(join(notesPath(), `${id}.md`), 'utf8')).rejects.toThrow();
  });

  test('delete unknown id exits 1 with error on stderr', async () => {
    if (!binaryAvailable) {
      return;
    }
    const r = await spawnCli(['delete', 'badid']);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("no note with id 'badid'");
  });

  test('edit replaces content', async () => {
    if (!binaryAvailable) {
      return;
    }
    const r1 = await spawnCli(['create', 'initial']);
    const id = r1.stdout.trim();
    const r2 = await spawnCli(['edit', id, 'new content']);
    expect(r2.exitCode).toBe(0);
    const content = await readFile(join(notesPath(), `${id}.md`), 'utf8');
    expect(content).toBe('new content');
  });

  test('create with no text reads stdin', async () => {
    if (!binaryAvailable) {
      return;
    }
    const r = await spawnCli(['create'], 'stdin note');
    expect(r.exitCode).toBe(0);
    const id = r.stdout.trim();
    const content = await readFile(join(notesPath(), `${id}.md`), 'utf8');
    expect(content).toBe('stdin note');
  });

  test('edit with no text reads stdin', async () => {
    if (!binaryAvailable) {
      return;
    }
    const r1 = await spawnCli(['create', 'original']);
    const id = r1.stdout.trim();
    const r2 = await spawnCli(['edit', id], 'piped replacement');
    expect(r2.exitCode).toBe(0);
    const content = await readFile(join(notesPath(), `${id}.md`), 'utf8');
    expect(content).toBe('piped replacement');
  });

  test('--help lists all subcommands and exits 0', async () => {
    if (!binaryAvailable) {
      return;
    }
    const r = await spawnCli(['--help']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('create');
    expect(r.stdout).toContain('list');
    expect(r.stdout).toContain('delete');
    expect(r.stdout).toContain('edit');
  });

  test('--version prints semver from package.json', async () => {
    if (!binaryAvailable) {
      return;
    }
    const r = await spawnCli(['--version']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/\d+\.\d+\.\d+/);
  });

  test('no args exits 1', async () => {
    if (!binaryAvailable) {
      return;
    }
    const r = await spawnCli([]);
    expect(r.exitCode).toBe(1);
  });

  test('unknown subcommand exits 1', async () => {
    if (!binaryAvailable) {
      return;
    }
    const r = await spawnCli(['bogus']);
    expect(r.exitCode).toBe(1);
  });
});
