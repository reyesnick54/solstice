/**
 * Access Economy simulation CLI plane.
 */

import { ACCESS_ECONOMY_CATALOG, accessScenarioById, accessScenarioIds } from './catalog.ts';
import { runAccessEconomyScenario } from './engine.ts';
import { ACCESS_ECONOMY_INVARIANT_IDS } from './ids.ts';
import { ACCESS_INVARIANT_STATEMENTS } from './invariants.ts';
import { qualifyAccessEconomy, renderAccessQualification } from './qualification.ts';

function replacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

function flag(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function usage(): string {
  return [
    'sunrey-economics access scenario [--list] [--id <id>]',
    'sunrey-economics access run --scenario <id> [--seed n]',
    'sunrey-economics access invariants',
    'sunrey-economics access qualify [--seed n] [--json]',
  ].join('\n');
}

export function runAccessEconomyCommand(argv: readonly string[]): string {
  const [command, ...rest] = argv;
  switch (command) {
    case 'scenario': {
      const id = flag(rest, '--id');
      if (rest.includes('--list') || !id) {
        return ACCESS_ECONOMY_CATALOG.map(
          (row) => `${row.scenarioId}\t${row.title}\tmacro=${row.macroScenarioId}\tseed=${row.seed}`,
        ).join('\n');
      }
      const scenario = accessScenarioById(id);
      if (!scenario) {
        throw new Error(`unknown access economy scenario ${id}`);
      }
      return JSON.stringify(scenario, replacer, 2);
    }
    case 'run': {
      const id = flag(rest, '--scenario') ?? accessScenarioIds()[0]!;
      const seed = flag(rest, '--seed');
      const result = runAccessEconomyScenario(id, seed ? { seed: Number(seed) } : undefined);
      return JSON.stringify(
        {
          scenarioId: result.scenarioId,
          seed: result.seed,
          scarcityMode: result.scarcityMode,
          scarcityDimension: result.scarcityDimension,
          outcomeCounts: result.outcomeCounts,
          totalPublishedUnits: result.totalPublishedUnits,
          totalGrantedUnits: result.totalGrantedUnits,
          oversoldUnits: result.oversoldUnits,
          invariantsHeld: result.invariantsHeld,
          evidence: result.evidence,
          resultDigestSha256: result.resultDigestSha256,
          productionActivation: result.productionActivation,
        },
        replacer,
        2,
      );
    }
    case 'invariants':
      return ACCESS_ECONOMY_INVARIANT_IDS.map(
        (invariant) => `${invariant}\t${ACCESS_INVARIANT_STATEMENTS[invariant]}`,
      ).join('\n');
    case 'qualify': {
      const seed = flag(rest, '--seed');
      const report = qualifyAccessEconomy(seed ? { seed: Number(seed) } : undefined);
      if (rest.includes('--json')) {
        return JSON.stringify(
          {
            qualificationState: report.qualificationState,
            scenarioCount: report.scenarioCount,
            allInvariantsHeld: report.allInvariantsHeld,
            evidenceChainsVerified: report.evidenceChainsVerified,
            oversoldUnits: report.oversoldUnits,
            invariantViolations: report.invariantViolations,
            productionPosture: report.productionPosture,
            remainingSimulatedDependencies: report.remainingSimulatedDependencies,
            remainingRealWorldProviderRequirements: report.remainingRealWorldProviderRequirements,
            remainingLegalGates: report.remainingLegalGates,
          },
          replacer,
          2,
        );
      }
      return renderAccessQualification(report);
    }
    default:
      return usage();
  }
}
