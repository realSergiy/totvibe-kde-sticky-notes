// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const SOURCE = resolve('package/contents/config/main.xml');
const TARGET = resolve('src/widget/generated/configuration.d.ts');

const TS_TYPES: Record<string, string> = {
  String: 'string',
  Bool: 'boolean',
  Int: 'number',
  UInt: 'number',
  Double: 'number',
  StringList: 'string[]',
};

const ENTRY_RE = /<entry\s+([^/>]*?)\/>|<entry\s+([^>]*?)>([\s\S]*?)<\/entry>/g;
const ATTR_RE = /(\w+)\s*=\s*"([^"]*)"/g;

const parseAttrs = (s: string) => {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(ATTR_RE)) {
    out[m[1] as string] = m[2] as string;
  }
  return out;
};

const xml = await readFile(SOURCE, 'utf8');
const fields: { name: string; ts: string }[] = [];
for (const m of xml.matchAll(ENTRY_RE)) {
  const attrs = parseAttrs((m[1] ?? m[2]) as string);
  const name = attrs['name'];
  const kcfgType = attrs['type'];
  if (name === undefined || kcfgType === undefined) {
    continue;
  }
  const ts = TS_TYPES[kcfgType];
  if (ts === undefined) {
    throw new Error(`gen-types: unsupported kcfg type '${kcfgType}' on entry '${name}'`);
  }
  fields.push({ name, ts });
}

if (fields.length === 0) {
  throw new Error(`gen-types: no <entry> elements found in ${SOURCE}`);
}

const body = fields.map((f) => `    ${f.name}: ${f.ts};`).join('\n');
const out = `// SPDX-License-Identifier: GPL-3.0-or-later
// Auto-generated from package/contents/config/main.xml — do not edit by hand.
declare namespace Plasmoid {
  type Configuration = {
${body}
  };
  const configuration: Configuration;
}
`;

await mkdir(dirname(TARGET), { recursive: true });
await writeFile(TARGET, out, 'utf8');
console.info(`gen-types: wrote ${fields.length} field${fields.length === 1 ? '' : 's'} to ${TARGET}`);
