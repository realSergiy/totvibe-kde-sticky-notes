// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile } from 'node:fs/promises';
import { argv, exit } from 'node:process';
import { Glob } from 'bun';

const SPDX_RE = /SPDX-License-Identifier:\s*GPL-3\.0-or-later/;
const SOURCE_GLOB = '**/*.{ts,tsx,js,jsx,qml}';
const SOURCE_RE = /\.(ts|tsx|js|jsx|qml)$/;
const EXCLUDED_PREFIXES = ['node_modules/', 'dist/', 'package/contents/js/', 'src/widget/generated/'];
const HEAD_BYTES = 512;

const collect = async () => {
  const explicit = argv.slice(2).filter((a) => !a.startsWith('-'));
  if (explicit.length > 0) {
    return explicit.filter((p) => SOURCE_RE.test(p));
  }
  const files: string[] = [];
  const glob = new Glob(SOURCE_GLOB);
  for await (const p of glob.scan({ cwd: '.', onlyFiles: true, dot: false })) {
    if (EXCLUDED_PREFIXES.some((pre) => p.startsWith(pre))) {
      continue;
    }
    files.push(p);
  }
  return files;
};

const files = await collect();
const missing: string[] = [];

for (const f of files) {
  const head = (await readFile(f, 'utf8')).slice(0, HEAD_BYTES);
  if (!SPDX_RE.test(head)) {
    missing.push(f);
  }
}

if (missing.length > 0) {
  console.error("Missing 'SPDX-License-Identifier: GPL-3.0-or-later' in:");
  for (const f of missing) {
    console.error(`  ${f}`);
  }
  exit(1);
}

console.info(`SPDX header OK (${files.length} file${files.length === 1 ? '' : 's'})`);
