// Sync the canonical @omadia/canvas-core sources from the omadia monorepo into
// this repo's packages/canvas-core. No vendored/committed copy => no drift: the
// protocol core (src), schemas, tests, and fixtures are fetched from the single
// source of truth at install/test time and are gitignored here.
//
// Source: the omadia monorepo's canvas-core package. Override the repo path
// with OMADIA_REPO (default: ../omadia sibling checkout).
//
// Mirrored exactly (local dir is replaced): src/ (minus the middleware plugin
// entry), schema/, test/, fixtures/. Copied without deleting local extras:
// tools/ (this repo keeps mobile-only dev tools like smoke.ts).
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const omadiaRepo = resolve(repoRoot, process.env.OMADIA_REPO ?? '../omadia');
const src = join(omadiaRepo, 'middleware/packages/canvas-core');
const dest = join(repoRoot, 'packages/canvas-core');

if (!existsSync(src)) {
  console.error(
    `sync-canvas-core: canonical package not found at ${src}\n` +
      'Clone https://github.com/byte5ai/omadia as a sibling checkout, or set OMADIA_REPO.',
  );
  process.exit(1);
}

// Excluded from the mirror: the middleware plugin entry (server-side wrapper)
// and the generated validator module (regenerated locally by `bun run gen`).
// validators.generated.d.mts stays: despite the name it is a hand-written,
// upstream-tracked declaration file.
const SRC_EXCLUDE = new Set(['plugin.ts', 'validators.generated.mjs']);

function mirrorDir(rel, filter) {
  const from = join(src, rel);
  const to = join(dest, rel);
  rmSync(to, { recursive: true, force: true });
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (filter && !filter(entry.name)) continue;
    cpSync(join(from, entry.name), join(to, entry.name), { recursive: true });
  }
  console.log(`sync-canvas-core: mirrored ${rel}/`);
}

mirrorDir('src', (n) => !SRC_EXCLUDE.has(n));
mirrorDir('schema');
mirrorDir('test');
mirrorDir('fixtures');

// tools/: overlay upstream files, keep mobile-only extras (smoke.ts).
const TOOLS_EXCLUDE = new Set(['copyGenerated.mjs']);
for (const entry of readdirSync(join(src, 'tools'), { withFileTypes: true })) {
  if (TOOLS_EXCLUDE.has(entry.name)) continue;
  cpSync(join(src, 'tools', entry.name), join(dest, 'tools', entry.name), { recursive: true });
}
console.log('sync-canvas-core: overlaid tools/');
console.log(`sync-canvas-core: done (source: ${src})`);
