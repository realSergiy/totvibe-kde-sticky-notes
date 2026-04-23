// SPDX-License-Identifier: GPL-3.0-or-later
// Tiny file IO for QML — uses XMLHttpRequest against file:// URLs.
// PUT/DELETE need `QML_XHR_ALLOW_FILE_WRITE=1` in the QML engine's environment.

type Xhr = {
  readyState: number;
  status: number;
  responseText: string;
  open: (method: string, url: string, async?: boolean) => void;
  send: (body?: string) => void;
  onreadystatechange: (() => void) | null;
};

declare const XMLHttpRequest: { new (): Xhr };

const READY_DONE = 4;
const HTTP_OK_MIN = 200;
const HTTP_OK_MAX = 300;
const JSON_INDENT = 2;
const POSITIONS_PATH = '.meta/positions.json';

export type Geometry = { x: number; y: number; width: number; height: number };
export type PositionsMap = Record<string, Geometry>;

const isSafeId = (s: string) => s.length > 0 && !s.includes('/') && !s.includes('\\') && !s.includes('..');

const trimSlash = (s: string) => (s.endsWith('/') ? s.slice(0, -1) : s);

const noteUrl = (notesDirUrl: string, id: string) => `${trimSlash(notesDirUrl)}/${id}.md`;

const positionsUrl = (notesDirUrl: string) => `${trimSlash(notesDirUrl)}/${POSITIONS_PATH}`;

const isOkStatus = (s: number) => s === 0 || (s >= HTTP_OK_MIN && s < HTTP_OK_MAX);

const request = (method: string, url: string, body?: string) =>
  new Promise<{ ok: boolean; text: string }>((resolve) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open(method, url);
      xhr.onreadystatechange = () => {
        if (xhr.readyState !== READY_DONE) {
          return;
        }
        resolve({ ok: isOkStatus(xhr.status), text: xhr.responseText ?? '' });
      };
      if (body === undefined) {
        xhr.send();
      } else {
        xhr.send(body);
      }
    } catch (_) {
      resolve({ ok: false, text: '' });
    }
  });

const requestSync = (method: string, url: string, body?: string) => {
  try {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, false);
    if (body === undefined) {
      xhr.send();
    } else {
      xhr.send(body);
    }
    return { ok: isOkStatus(xhr.status), text: xhr.responseText ?? '' };
  } catch (_) {
    return { ok: false, text: '' };
  }
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const readNote = (notesDirUrl: string, id: string) => {
  if (!isSafeId(id)) {
    return Promise.resolve({ ok: false, missing: true, content: '' });
  }
  return request('GET', noteUrl(notesDirUrl, id)).then(({ ok, text }) => ({
    ok,
    missing: !ok,
    content: ok ? text : '',
  }));
};

export const writeNote = (notesDirUrl: string, id: string, content: string) => {
  if (!isSafeId(id)) {
    return Promise.resolve(false);
  }
  return request('PUT', noteUrl(notesDirUrl, id), content).then(({ ok }) => ok);
};

export const writeNoteSync = (notesDirUrl: string, id: string, content: string) => {
  if (!isSafeId(id)) {
    return false;
  }
  return requestSync('PUT', noteUrl(notesDirUrl, id), content).ok;
};

export const deleteNote = (notesDirUrl: string, id: string) => {
  if (!isSafeId(id)) {
    return Promise.resolve(false);
  }
  return request('DELETE', noteUrl(notesDirUrl, id)).then(({ ok }) => ok);
};

export const readPositions = (notesDirUrl: string) =>
  request('GET', positionsUrl(notesDirUrl)).then(({ ok, text }) => {
    if (!ok || text === '') {
      return {} as PositionsMap;
    }
    try {
      const parsed = JSON.parse(text) as unknown;
      return isPlainObject(parsed) ? (parsed as PositionsMap) : ({} as PositionsMap);
    } catch (_) {
      return {} as PositionsMap;
    }
  });

const writePositions = (notesDirUrl: string, map: PositionsMap) =>
  request('PUT', positionsUrl(notesDirUrl), JSON.stringify(map, null, JSON_INDENT)).then(({ ok }) => ok);

export const upsertPosition = (notesDirUrl: string, id: string, geom: Geometry) =>
  readPositions(notesDirUrl).then((map) => {
    map[id] = geom;
    return writePositions(notesDirUrl, map);
  });

export const removePosition = (notesDirUrl: string, id: string) =>
  readPositions(notesDirUrl).then((map) => {
    if (!(id in map)) {
      return true;
    }
    delete map[id];
    return writePositions(notesDirUrl, map);
  });
