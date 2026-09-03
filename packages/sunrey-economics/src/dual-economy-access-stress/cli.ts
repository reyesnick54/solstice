// @ts-nocheck
/**
 * ACCESS-22 CLI plane.
 */

import { ACCESS_22_CATALOG, access22ScenarioById } from './catalog.ts';
import { runAccess22Campaign } from './campaign.ts';
import { runAccess22Scenario } from './engine.ts';
import { ACCESS_22_INVARIANT_IDS } from './ids.ts';
import { ACCESS_22_INVARIANT_STATEMENTS } from './invariants.ts';
import { qualifyDualEconomyAccess, renderAccess22Qualification } from './qualification.ts';

function replacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

function flag(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function usage(): string {
  return [
    'sunrey-economics access22 scenario [--list] [--id <id>]',
    'sunrey-economics access22 run --scenario <id> [--seed n] [--scale SCALE_1K]',
    'sunrey-economics access22 campaign [--smoke] [--heavy] [--seed n]',
    'sunrey-economics access22 invariants',
    'sunrey-economics access22 qualify [--seed n] [--json]',
  ].join('\n');
}

export function runAccess22Command(argv: readonly string[]): string {
  const [command, ...rest] = argv;
  switch (command) {
    case 'scenario': {
      const id = flag(rest, '--id');
      if (rest.includes('--list') || !id) {
        return ACCESS_22_CATALOG.map(
          (row) => `${row.scenarioId}\t${row.title}\tmacro=${row.macroScenarioId}\tseed=${row.seed}`,
        ).join('\n');
      }
      const scenario = access22ScenarioById(id);
      if (!scenario) {
        throw new Error(`unknown ACCESS-22 scenario ${id}`);
      }
      return JSON.stringify(scenario, replacer, 2);
    }
    case 'run': {
      const id = flag(rest, '--scenario') ?? ACCESS_22_CATALOG[0]!.scenarioId;
      const seed = flag(rest, '--seed');
      const scale = flag(rest, '--scale') as import('./ids.ts').Access22ScaleLevel | undefined;
      const result = runAccess22Scenario(id, {
        seed: seed ? Number(seed) : undefined,
        scaleLevel: scale ?? 'SCALE_1K',
      });
      return JSON.stringify(
        {
          scenarioId: result.scenarioId,
          seed: result.seed,
          scaleLevel: result.scaleLevel,
          allInvariantsHeld: result.allInvariantsHeld,
          classifications: result.classifications,
          aggregateMetrics: result.aggregateMetrics,
          mechanismTests: result.mechanismTests,
          resultDigestSha256: result.resultDigestSha256,
        },
        replacer,
        2,
      );
    }
    case 'campaign': {
      const result = runAccess22Campaign({
        smoke: rest.includes('--smoke'),
        heavy: rest.includes('--heavy'),
        seed: flag(rest, '--seed') ? Number(flag(rest, '--seed')) : undefined,
      });
      return JSON.stringify(
        {
          campaignId: result.campaignId,
          passed: result.passed,
          failed: result.failed,
          violations: result.violations,
          scaleLevels: result.scaleLevels,
          scenarioCount: result.scenarioIds.length,
        },
        replacer,
        2,
      );
    }
    case 'invariants':
      return ACCESS_22_INVARIANT_IDS.map(
        (invariant) => `${invariant}\t${ACCESS_22_INVARIANT_STATEMENTS[invariant]}`,
      ).join('\n');
    case 'qualify': {
      const report = qualifyDualEconomyAccess(
        flag(rest, '--seed') ? { seed: Number(flag(rest, '--seed')) } : undefined,
      );
      if (rest.includes('--json')) {
        return JSON.stringify(
          {
            qualificationState: report.qualificationState,
            scenariosRun: report.scenariosRun,
            scenariosPassed: report.scenariosPassed,
            scenariosFailed: report.scenariosFailed,
            allInvariantsHeld: report.allInvariantsHeld,
            mechanismTestsPassed: report.mechanismTestsPassed,
            benchmarkTestsPassed: report.benchmarkTestsPassed,
            agentStressPassed: report.agentStressPassed,
            postScarcityPassed: report.postScarcityPassed,
            monteCarloViolations: report.monteCarloViolations,
            productionPosture: report.productionPosture,
          },
          replacer,
          2,
        );
      }
      return renderAccess22Qualification(report);
    }
    default:
      return usage();
  }
}
