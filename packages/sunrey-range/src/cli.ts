import { writeFileSync } from 'node:fs';

import { persistCampaign, runCampaign, runSmokeCampaign } from './campaign.ts';
import { SCENARIO_CATALOG, renderAttackMatrixMarkdown, runScenarioIsolated, scenarioById } from './catalog.ts';
import { createRangeEnvironment } from './environment.ts';
import { evidenceRecord, writeEvidenceArtifact } from './evidence.ts';
import { catalogComplete, invariantIds } from './invariants.ts';

export function runRangeCli(argv: readonly string[]): number {
  const [, , command, ...rest] = argv;
  if (command === 'run' || command === undefined) {
    const env = createRangeEnvironment(57);
    console.log(JSON.stringify({
      command: 'run',
      networkId: env.networkId,
      chainId: env.chainId,
      validators: 7,
      credentials: env.credentials,
      scenarioCount: SCENARIO_CATALOG.length,
      invariants: invariantIds(),
      catalogComplete: catalogComplete(),
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
    }, null, 2));
    return 0;
  }
  if (command === 'scenario') {
    const id = rest[0];
    if (!id || !scenarioById(id)) {
      console.error(`unknown scenario ${id ?? '(missing)'}`);
      return 1;
    }
    const result = runScenarioIsolated(id);
    console.log(JSON.stringify(result, jsonReplacer, 2));
    return result.passed ? 0 : 2;
  }
  if (command === 'campaign') {
    const smoke = rest.includes('--smoke');
    const report = persistCampaign(smoke ? runSmokeCampaign() : runCampaign());
    console.log(JSON.stringify({
      smoke,
      scenarioCount: report.scenarioCount,
      passed: report.passed,
      failed: report.failed,
      scorecard: report.scorecard,
    }, null, 2));
    return report.failed === 0 ? 0 : 2;
  }
  if (command === 'report') {
    const report = runSmokeCampaign();
    console.log(JSON.stringify({
      scenarioCount: report.scenarioCount,
      passed: report.passed,
      failed: report.failed,
      scorecard: report.scorecard,
      results: report.results.map((row) => ({
        scenarioId: row.scenarioId,
        passed: row.passed,
        attackBlocked: row.attackBlocked,
        safetyHeld: row.safetyHeld,
        livenessDegraded: row.livenessDegraded,
      })),
    }, jsonReplacer, 2));
    return report.failed === 0 ? 0 : 2;
  }
  if (command === 'replay') {
    const id = rest[0] ?? 'BFT-DOUBLE-PROPOSAL';
    const first = runScenarioIsolated(id);
    const second = runScenarioIsolated(id);
    const comparable = (row: typeof first) => ({
      scenarioId: row.scenarioId,
      seed: row.seed,
      attackBlocked: row.attackBlocked,
      safetyHeld: row.safetyHeld,
      passed: row.passed,
      notes: row.notes,
    });
    const deterministic = JSON.stringify(comparable(first)) === JSON.stringify(comparable(second));
    writeEvidenceArtifact(`artifacts/sunrey-range/replay-${id}.json`, evidenceRecord(second));
    console.log(JSON.stringify({ scenarioId: id, deterministic, first: comparable(first), second: comparable(second) }, null, 2));
    return deterministic && first.passed && second.passed ? 0 : 2;
  }
  if (command === 'matrix') {
    writeFileSync('docs/assurance/attack-matrix.md', renderAttackMatrixMarkdown());
    console.log(`wrote ${SCENARIO_CATALOG.length} matrix rows`);
    return 0;
  }
  console.error('sunrey-range run | scenario <id> | campaign [--smoke] | report | replay [id]');
  return 1;
}

function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}
