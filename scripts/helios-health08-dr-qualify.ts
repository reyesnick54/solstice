#!/usr/bin/env node
/**
 * HEALTH08 — HELIOS restart, backup, and disaster-recovery qualification runner.
 */

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HELIOS_RESTART_RECOVERY_BLOCKED,
  HELIOS_RESTART_RECOVERY_QUALIFIED,
} from '../packages/platform/src/helios/hardening/restart-recovery-qualification.ts';
import { renderHeliosDisasterRecoveryQualificationMarkdown } from '../performance/wave9/lib/helios-dr-report.ts';
import { runHeliosDrQualification } from '../performance/wave9/lib/helios-dr-wave9.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOC = join(ROOT, 'docs/helios/hardening/HELIOS_DISASTER_RECOVERY_QUALIFICATION.md');

function gitSha(): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : 'unknown';
}

async function tryPostgresTier(): Promise<{ attempted: boolean; pass: boolean }> {
  if (process.env.SUNREY_PERSISTENCE_TEST !== '1') {
    return { attempted: false, pass: false };
  }
  const dbUp = spawnSync('npm', ['run', 'db:up'], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
  if (dbUp.status !== 0) {
    return { attempted: true, pass: false };
  }
  const migrate = spawnSync('npm', ['run', 'db:migrate'], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
  const qualify = spawnSync('npm', ['run', 'qualify:backend-db', '--', '--skip-persistence'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, SUNREY_PERSISTENCE_TEST: '1' },
  });
  return { attempted: true, pass: migrate.status === 0 && qualify.status === 0 };
}

async function main(): Promise<void> {
  const pg = await tryPostgresTier();
  if (pg.pass) {
    process.env.SUNREY_HELIOS_DR_PG_TIER_PASS = '1';
  }
  const qualification = runHeliosDrQualification({
    postgresTierAttempted: pg.attempted,
    postgresTierPass: pg.pass,
  });

  const evaluatedAtUtc = new Date().toISOString();
  const sha = gitSha();
  writeFileSync(
    DOC,
    `${renderHeliosDisasterRecoveryQualificationMarkdown(qualification, {
      gitSha: sha,
      evaluatedAtUtc,
    })}\n`,
  );

  console.log(
    JSON.stringify(
      {
        marker: qualification.marker,
        qualified: qualification.qualified,
        blockers: qualification.blockers,
        engineeringSlo: qualification.report.engineeringSlo,
        postgresTier: pg,
        doc: DOC,
      },
      null,
      2,
    ),
  );

  if (qualification.marker === HELIOS_RESTART_RECOVERY_BLOCKED) {
    process.exit(1);
  }
  if (qualification.marker !== HELIOS_RESTART_RECOVERY_QUALIFIED) {
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
