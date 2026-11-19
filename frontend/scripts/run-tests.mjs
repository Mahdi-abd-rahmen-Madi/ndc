import { readdirSync, rmSync, mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

const rootDir = resolve(import.meta.dirname, '..');
const testDir = join(rootDir, 'src', '__tests__');
const testFiles = readdirSync(testDir)
  .filter((f) => f.endsWith('.test.ts'))
  .map((f) => join(testDir, f));

if (testFiles.length === 0) {
  console.error('No *.test.ts files found in src/__tests__');
  process.exit(1);
}

const outDir = mkdtempSync(join(tmpdir(), 'ndc-fe-tests-'));

try {
  await build({
    entryPoints: testFiles,
    outdir: outDir,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(''),
    },
    outExtension: { '.js': '.mjs' },
  });

  const builtFiles = readdirSync(outDir)
    .filter((f) => f.endsWith('.mjs'))
    .map((f) => join(outDir, f));

  const res = spawnSync(process.execPath, ['--test', ...builtFiles], {
    stdio: 'inherit',
  });
  process.exit(res.status ?? 1);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

