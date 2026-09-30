// Bundles each src/handlers/<name>.ts into dist/<name>.zip for Lambda.
//
//   npm run build -w @dialplan/api            # every function
//   npm run build -w @dialplan/api -- route   # just one
//
// The zips are byte-for-byte reproducible (fixed timestamps, no absolute
// paths), so Terraform's source_code_hash only changes when the code does.

import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { zipSync } from 'fflate';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const handlersDir = path.join(root, 'src/handlers');
const distDir = path.join(root, 'dist');
// Zip entries store local wall-clock time, so build the date from local
// components: every machine then writes the same bytes, whatever its zone.
const ZIP_MTIME = new Date(2000, 0, 1);

const available = (await readdir(handlersDir))
  .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
  .map((file) => path.basename(file, '.ts'));

const requested = process.argv.slice(2);
const unknown = requested.filter((name) => !available.includes(name));
if (unknown.length > 0) {
  console.error(`Unknown function: ${unknown.join(', ')}. Available: ${available.join(', ')}`);
  process.exit(1);
}

for (const name of requested.length > 0 ? requested : available) {
  const outdir = path.join(distDir, name);
  await rm(outdir, { recursive: true, force: true });

  await build({
    entryPoints: [path.join(handlersDir, `${name}.ts`)],
    outfile: path.join(outdir, 'index.mjs'),
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'esm',
    mainFields: ['module', 'main'],
    minify: true,
    sourcemap: 'linked',
    sourcesContent: false,
    legalComments: 'none',
    logLevel: 'warning',
  });

  const files = {};
  for (const file of ['index.mjs', 'index.mjs.map']) {
    files[file] = [await readFile(path.join(outdir, file)), { mtime: ZIP_MTIME }];
  }
  const zip = zipSync(files, { level: 9 });
  await writeFile(path.join(distDir, `${name}.zip`), zip);
  console.log(`${name}.zip  ${(zip.length / 1024).toFixed(0)} KiB`);
}
