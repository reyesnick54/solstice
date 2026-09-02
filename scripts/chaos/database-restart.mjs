#!/usr/bin/env node
/**
 * Chaos automation — database restart qualification pointer.
 * Runs qualify:backend-db when PostgreSQL is available.
 */
import { spawnSync } from 'node:child_process';
import { ENVIRONMENT } from '../../packages/config/src/flags.ts';

if (ENVIRONMENT !== 'simulation') {
  console.error('[chaos:database-restart] refused — ENVIRONMENT must be simulation');
  process.exit(1);
}

const pgUrl = process.env.SUNREY_DATABASE_URL ?? process.env.DATABASE_URL;
if (!pgUrl) {
  console.log(JSON.stringify({
    scenario: 'database-restart',
    status: 'ENVIRONMENT_LIMITED',
    note: 'Set SUNREY_DATABASE_URL and run npm run db:up && npm run qualify:backend-db',
  }, null, 2));
  process.exit(0);
}

const result = spawnSync('npm', ['run', 'qualify:backend-db'], { stdio: 'inherit', shell: true });
console.log(JSON.stringify({
  scenario: 'database-restart',
  status: result.status === 0 ? 'TARGET_MET' : 'TARGET_NOT_MET',
  exitCode: result.status,
}, null, 2));
process.exit(result.status ?? 1);
