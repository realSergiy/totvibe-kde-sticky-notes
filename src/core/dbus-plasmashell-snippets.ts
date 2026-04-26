// SPDX-License-Identifier: GPL-3.0-or-later
import type { Geometry, NoteId } from './types.ts';

export const PLASMASHELL_PLUGIN_ID = 'com.totvibe.stickynotes';
const SAFE_ID = /^[\w.-]+$/;

const checkId = (id: string) => {
  if (!SAFE_ID.test(id)) {
    throw new Error(`Unsafe note id: ${JSON.stringify(id)}`);
  }
  return id;
};

const checkNum = (n: number) => {
  const v = Number(n);
  if (!Number.isFinite(v)) {
    throw new Error(`Non-finite coordinate: ${n}`);
  }
  return Math.round(v);
};

export const buildSpawnSnippet = (id: NoteId, g: Geometry) => {
  const s = checkId(id);
  const x = checkNum(g.x);
  const y = checkNum(g.y);
  const w = checkNum(g.width);
  const h = checkNum(g.height);
  return [
    'var ds = desktops();',
    'var exists = false;',
    'for (var i = 0; i < ds.length && !exists; i++) {',
    `  var ws = ds[i].widgets("${PLASMASHELL_PLUGIN_ID}");`,
    '  for (var j = 0; j < ws.length; j++) {',
    '    var a = ws[j];',
    '    a.currentConfigGroup = ["General"];',
    `    if (a.readConfig("noteId", "") === "${s}") { exists = true; break; }`,
    '  }',
    '}',
    'if (!exists && ds.length > 0) {',
    `  var added = ds[0].addWidget("${PLASMASHELL_PLUGIN_ID}", ${x}, ${y}, ${w}, ${h});`,
    '  added.currentConfigGroup = ["General"];',
    `  added.writeConfig("noteId", "${s}");`,
    '}',
  ].join('\n');
};

export const buildDespawnSnippet = (id: NoteId) => {
  const s = checkId(id);
  return [
    'var ds = desktops();',
    'for (var i = 0; i < ds.length; i++) {',
    `  var ws = ds[i].widgets("${PLASMASHELL_PLUGIN_ID}");`,
    '  for (var j = 0; j < ws.length; j++) {',
    '    var a = ws[j];',
    '    a.currentConfigGroup = ["General"];',
    `    if (a.readConfig("noteId", "") === "${s}") { a.remove(); }`,
    '  }',
    '}',
  ].join('\n');
};

export const buildReconcileSnippet = (validIds: readonly NoteId[]) => {
  const ids = validIds.map((id) => `"${checkId(id)}"`).join(',');
  return [
    `var valid = [${ids}];`,
    'var set = {};',
    'for (var k = 0; k < valid.length; k++) set[valid[k]] = true;',
    'var ds = desktops();',
    'for (var i = 0; i < ds.length; i++) {',
    `  var ws = ds[i].widgets("${PLASMASHELL_PLUGIN_ID}");`,
    '  for (var j = 0; j < ws.length; j++) {',
    '    var a = ws[j];',
    '    a.currentConfigGroup = ["General"];',
    '    var nid = a.readConfig("noteId", "");',
    '    if (nid !== "" && !set[nid]) { a.remove(); }',
    '  }',
    '}',
  ].join('\n');
};
