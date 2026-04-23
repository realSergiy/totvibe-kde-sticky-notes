// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  deleteNote,
  readNote,
  readPositions,
  removePosition,
  upsertPosition,
  writeNote,
  writeNoteSync,
} from '../../src/widget/io.ts';

type Call = { method: string; url: string; body: string | undefined; sync: boolean };

type FakeFile = { content: string; status: number };

type Globals = {
  XMLHttpRequest?: unknown;
};

const installFakeXhr = () => {
  const calls: Call[] = [];
  const files = new Map<string, FakeFile>();

  class FakeXhr {
    readyState = 0;
    status = 0;
    responseText = '';
    onreadystatechange: (() => void) | null = null;
    private method = '';
    private url = '';
    private async = true;

    open(method: string, url: string, async = true) {
      this.method = method;
      this.url = url;
      this.async = async;
    }

    send(body?: string) {
      const file = files.get(this.url);
      if (this.method === 'GET') {
        if (file) {
          this.status = file.status;
          this.responseText = file.content;
        } else {
          this.status = 404;
          this.responseText = '';
        }
      } else if (this.method === 'PUT') {
        files.set(this.url, { content: body ?? '', status: 200 });
        this.status = 0;
      } else if (this.method === 'DELETE') {
        if (files.delete(this.url)) {
          this.status = 0;
        } else {
          this.status = 404;
        }
      } else {
        this.status = 405;
      }
      calls.push({ method: this.method, url: this.url, body, sync: !this.async });
      this.readyState = 4;
      this.onreadystatechange?.();
    }
  }

  const g = globalThis as Globals;
  g.XMLHttpRequest = FakeXhr;
  return { calls, files };
};

const uninstallFakeXhr = () => {
  const g = globalThis as Globals;
  delete g.XMLHttpRequest;
};

let fake: ReturnType<typeof installFakeXhr>;

const NOTES = 'file:///tmp/notes';
const POS = `${NOTES}/.meta/positions.json`;

beforeEach(() => {
  fake = installFakeXhr();
});

afterEach(() => {
  uninstallFakeXhr();
});

describe('io.readNote', () => {
  test('returns missing for unsafe id', async () => {
    const got = await readNote(NOTES, '../escape');
    expect(got).toEqual({ ok: false, missing: true, content: '' });
  });

  test('returns missing for empty id', async () => {
    const got = await readNote(NOTES, '');
    expect(got.missing).toBe(true);
  });

  test('returns content for existing file', async () => {
    fake.files.set(`${NOTES}/abc.md`, { content: 'hello', status: 200 });
    const got = await readNote(NOTES, 'abc');
    expect(got).toEqual({ ok: true, missing: false, content: 'hello' });
  });

  test('strips trailing slash from notesDirUrl', async () => {
    fake.files.set(`${NOTES}/abc.md`, { content: 'x', status: 200 });
    const got = await readNote(`${NOTES}/`, 'abc');
    expect(got.content).toBe('x');
  });

  test('returns missing on 404', async () => {
    const got = await readNote(NOTES, 'nope');
    expect(got).toEqual({ ok: false, missing: true, content: '' });
  });
});

describe('io.writeNote', () => {
  test('PUTs to the right URL with the given body', async () => {
    const ok = await writeNote(NOTES, 'abc', 'body');
    expect(ok).toBe(true);
    expect(fake.calls).toEqual([{ method: 'PUT', url: `${NOTES}/abc.md`, body: 'body', sync: false }]);
  });

  test('rejects unsafe ids without sending', async () => {
    const ok = await writeNote(NOTES, '../escape', 'x');
    expect(ok).toBe(false);
    expect(fake.calls).toHaveLength(0);
  });
});

describe('io.writeNoteSync', () => {
  test('uses synchronous XHR mode', () => {
    const ok = writeNoteSync(NOTES, 'abc', 'final');
    expect(ok).toBe(true);
    expect(fake.calls).toEqual([{ method: 'PUT', url: `${NOTES}/abc.md`, body: 'final', sync: true }]);
  });
});

describe('io.deleteNote', () => {
  test('DELETE removes the file', async () => {
    fake.files.set(`${NOTES}/abc.md`, { content: 'x', status: 200 });
    const ok = await deleteNote(NOTES, 'abc');
    expect(ok).toBe(true);
    expect(fake.files.has(`${NOTES}/abc.md`)).toBe(false);
  });

  test('returns false on missing file', async () => {
    const ok = await deleteNote(NOTES, 'nope');
    expect(ok).toBe(false);
  });
});

describe('io positions', () => {
  test('readPositions returns empty map when missing', async () => {
    expect(await readPositions(NOTES)).toEqual({});
  });

  test('readPositions returns empty map on invalid JSON', async () => {
    fake.files.set(POS, { content: '{not json', status: 200 });
    expect(await readPositions(NOTES)).toEqual({});
  });

  test('upsertPosition writes geometry under id', async () => {
    await upsertPosition(NOTES, 'a', { x: 1, y: 2, width: 3, height: 4 });
    const written = JSON.parse(fake.files.get(POS)?.content ?? '');
    expect(written).toEqual({ a: { x: 1, y: 2, width: 3, height: 4 } });
  });

  test('upsertPosition merges with existing entries', async () => {
    fake.files.set(POS, { content: JSON.stringify({ a: { x: 0, y: 0, width: 1, height: 1 } }), status: 200 });
    await upsertPosition(NOTES, 'b', { x: 5, y: 5, width: 5, height: 5 });
    const written = JSON.parse(fake.files.get(POS)?.content ?? '');
    expect(Object.keys(written).sort()).toEqual(['a', 'b']);
  });

  test('removePosition deletes the id and rewrites', async () => {
    fake.files.set(POS, {
      content: JSON.stringify({ a: { x: 0, y: 0, width: 1, height: 1 }, b: { x: 0, y: 0, width: 1, height: 1 } }),
      status: 200,
    });
    await removePosition(NOTES, 'a');
    const written = JSON.parse(fake.files.get(POS)?.content ?? '');
    expect(Object.keys(written)).toEqual(['b']);
  });

  test('removePosition is a no-op when id is absent', async () => {
    await removePosition(NOTES, 'never-was-there');
    expect(fake.files.has(POS)).toBe(false);
  });
});
