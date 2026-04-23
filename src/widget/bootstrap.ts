// SPDX-License-Identifier: GPL-3.0-or-later
export type BoundNote = {
  id: string;
  content: string;
  missing: boolean;
};

type Xhr = {
  readyState: number;
  status: number;
  responseText: string;
  open: (method: string, url: string) => void;
  send: () => void;
  onreadystatechange: (() => void) | null;
};

declare const XMLHttpRequest: { new (): Xhr };

const READY_DONE = 4;
const HTTP_OK = 200;

const isSafeId = (s: string) => s.length > 0 && !s.includes('/') && !s.includes('\\') && !s.includes('..');

const fetchText = (url: string) =>
  new Promise<{ ok: boolean; text: string }>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== READY_DONE) {
        return;
      }
      const ok = xhr.status === HTTP_OK || xhr.status === 0;
      resolve({ ok, text: ok ? xhr.responseText : '' });
    };
    xhr.send();
  });

export const loadBoundNote = (notesDirUrl: string, noteId: string) => {
  if (!isSafeId(noteId)) {
    return Promise.resolve({ id: noteId, content: '', missing: true });
  }
  const base = notesDirUrl.endsWith('/') ? notesDirUrl.slice(0, -1) : notesDirUrl;
  return fetchText(`${base}/${noteId}.md`).then(({ ok, text }) => ({
    id: noteId,
    content: text,
    missing: !ok,
  }));
};
