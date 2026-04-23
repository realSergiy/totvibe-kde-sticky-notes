// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { Glob, Transpiler } from 'bun';

const SRC_ROOT = resolve('src/widget');
const OUT_DIR = resolve('package/contents/js');
const SOURCE_GLOB = '**/*.ts';
const OUT_EXT = '.mjs';
const SKIP_PREFIXES = ['generated/'];
const SKIP_SUFFIXES = ['.d.ts'];

const importRewrite = (code: string) =>
  code.replace(
    /(\bfrom\s+['"]|\bimport\s*\(\s*['"])([^'"]+?)\.ts(['"])/g,
    (_full, prefix: string, path: string, suffix: string) => `${prefix}${path}${OUT_EXT}${suffix}`,
  );

const transpiler = new Transpiler({ loader: 'ts', target: 'browser' });

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

const sources: string[] = [];
const glob = new Glob(SOURCE_GLOB);
for await (const rel of glob.scan({ cwd: SRC_ROOT, onlyFiles: true })) {
  if (SKIP_PREFIXES.some((p) => rel.startsWith(p))) {
    continue;
  }
  if (SKIP_SUFFIXES.some((s) => rel.endsWith(s))) {
    continue;
  }
  sources.push(rel);
}

for (const rel of sources) {
  const source = await readFile(resolve(SRC_ROOT, rel), 'utf8');
  const transpiled = transpiler.transformSync(source);
  const rewritten = importRewrite(transpiled);
  const target = resolve(OUT_DIR, rel.replace(/\.ts$/, OUT_EXT));
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, rewritten, 'utf8');
}

const out = sources
  .map((s) => `  ${relative(SRC_ROOT, resolve(SRC_ROOT, s))} -> ${s.replace(/\.ts$/, OUT_EXT)}`)
  .join('\n');
console.info(`build-widget: emitted ${sources.length} module${sources.length === 1 ? '' : 's'} to ${OUT_DIR}\n${out}`);
