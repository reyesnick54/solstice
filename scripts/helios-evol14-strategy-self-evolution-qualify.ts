#!/usr/bin/env node
/**
 * HELIOS EVOL14 — Strategy Genome self-evolution final qualification.
 * Simulation and research markers only; does not enable live execution.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_STRATEGY_SELF_EVOLUTION_V1_BLOCKED,
  HELIOS_STRATEGY_SELF_EVOLUTION_V1_QUALIFIED,
  evaluateStrategyGenomeSelfEvolutionQualification,
} from '../packages/strategy-lab/src/evolution/qualification.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS_DIR = join(ROOT, 'docs/helios/evolution');
const OUT_DIR = join(ROOT, 'performance/helios/results', 'helios-evol14');
const FINAL_REPORT = join(DOCS_DIR, 'HELIOS_STRATEGY_EVOLUTION_FINAL_REPORT.md');
const SKIP_SUBPROCESS = process.argv.includes('--skip-subprocess');

function gitSha(): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '0000000000000000000000000000000000000000';
}

function runTest(rel: string): boolean {
  if (SKIP_SUBPROCESS) {
    console.log(`[EVOL14] skip test ${rel} (--skip-subprocess)`);
    return true;
  }
  const result = spawnSync(
    'node',
    [
      '--experimental-strip-types',
      '--disable-warning=ExperimentalWarning',
      '--test',
      '--test-reporter=spec',
      rel,
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    console.error(`[EVOL14] test failed: ${rel}`);
    console.error((result.stderr || result.stdout || '').slice(0, 600));
  }
  return result.status === 0;
}

const sha = gitSha();
const now = asUtcInstant(new Date().toISOString());
const evolTestOk = runTest('packages/strategy-lab/src/evolution/evol14-strategy-self-evolution.test.ts');

const qualification = evaluateStrategyGenomeSelfEvolutionQualification({
  evaluatedAt: now,
  gitSha: sha,
});

const blockers: string[] = [...qualification.blockers.map((b) => String(b))];
if (!evolTestOk) {
  blockers.push('evol14 test subprocess failed');
}

const qualified = blockers.length === 0;
const marker = qualified ? HELIOS_STRATEGY_SELF_EVOLUTION_V1_QUALIFIED : HELIOS_STRATEGY_SELF_EVOLUTION_V1_BLOCKED;

mkdirSync(DOCS_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

const sim = qualification.simulation;
const jsonPath = join(OUT_DIR, `helios-evol14-qualification-${sha.slice(0, 12)}.json`);
writeFileSync(
  jsonPath,
  `${JSON.stringify(
    {
      marker,
      qualified,
      gitSha: sha,
      evaluatedAt: now,
      blockers,
      overfitRejected: sim.overfitCandidateRejected,
      moderatePreferred: sim.moderateCandidatePreferred,
      sealedEvidenceEntries: sim.sealedEvidenceTrail.length,
      trialCount: sim.trials.length,
    },
    null,
    2,
  )}\n`,
);

const report = `# HELIOS Strategy Evolution — Final Report (EVOL14)

**Generated (UTC):** ${now}  
**Git SHA:** \`${sha}\`  
**Qualification marker:** \`${marker}\`  
**Qualified:** ${qualified ? 'yes' : 'no'}

## Scope

Deterministic simulation of Strategy Genome self-evolution: seeds, population, mutation/crossover, invalid genome rejection, AAF V2 point-in-time dataset seal, inner train/validation, toy CMA-ES update, MAP-Elites-style archive cells, novelty distance, falsification stress, freeze, holdout diagnostics (DSR/PBO), challenger selection, forward shadow, Execution Twin paper track (no broker), champion/challenger comparison, research-only promotion, sealed evidence trail.

## Critical test — overfit rejection

Injected **flashy overfit** genome (\`sgnm_evol14_overfit_flashy\`): rejected when **any** of holdout degradation, non-positive DSR (multiple-testing adjusted), elevated PBO, fragility under stress, or regime gating applies.

**Rejection reasons observed:** ${sim.overfitRejectionReasons.join(', ') || '(none — qualification would block)'}

## Moderate candidate preference

Robust moderate genome preferred over flashy candidate: **${sim.moderateCandidatePreferred ? 'yes' : 'no'}**

## Live safety

- \`LIVE_TRADING_ENABLED\` must be \`false\` (enforced in qualification).
- Evolved strategies **do not** self-authorize live execution; promotion remains research-only (\`liveEligible: false\` on promotion capsule path; paper track is simulation).

## Evidence

- Trial ledger entries: ${String(sim.trials.length)} (success: ${String(sim.trialSuccessCount)}, failed: ${String(sim.trialFailureCount)})
- Sealed evidence hashes: ${String(sim.sealedEvidenceTrail.length)}
- JSON: \`${jsonPath.replace(ROOT + '/', '')}\`

See also: \`docs/helios/evolution/EVOLUTION_CAPABILITY_MATRIX.md\`, \`EVOLUTION_OVERFITTING_REPORT.md\`, \`EVOLUTION_LINEAGE_REPORT.md\`.
`;

writeFileSync(FINAL_REPORT, report);

console.log(
  JSON.stringify(
    {
      command: 'helios:evol14:qualify',
      marker,
      qualified,
      jsonPath: jsonPath.replace(ROOT + '/', ''),
      finalReport: FINAL_REPORT.replace(ROOT + '/', ''),
      blockers,
    },
    null,
    2,
  ),
);

process.exit(qualified ? 0 : 1);
