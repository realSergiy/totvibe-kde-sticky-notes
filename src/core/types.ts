// SPDX-License-Identifier: GPL-3.0-or-later
export type NoteId = string & { readonly __brand: 'NoteId' };

export type Geometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Note = {
  id: NoteId;
  content: string;
};

export type NoteSummary = {
  id: NoteId;
  firstLine: string;
  mtime: Date;
};

export type PositionsMap = Record<string, Geometry>;
