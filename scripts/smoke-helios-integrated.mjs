#!/usr/bin/env node
/**
 * HELIOS H35 smoke command.
 *
 * Local:
 *   npm run helios:h35:accept
 *
 * Remote (Hetzner sandbox):
 *   SUNREY_VERIFY_PREVIEW_EMAIL=... SUNREY_VERIFY_PREVIEW_PASSWORD=... \
 *   npm run smoke:helios-integrated -- --remote
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const remote = process.argv.includes('--remote');

const result = spawnSync(
  process.execPath,
  [
    '--experimental-strip-types',
    '--disable-warning=ExperimentalWarning',
    join(ROOT, 'scripts/helios-h35-accept.ts'),
    ...(remote ? ['--remote'] : []),
  ],
  { cwd: ROOT, stdio: 'inherit', env: process.env },
);

process.exit(result.status ?? 1);
