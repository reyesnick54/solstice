/**
 * sunrey-economics dual and stress CLI.
 */

import { writeFileSync } from 'node:fs';

import { runTreasuryCommand } from '../../sunrey-chain/src/economics/treasury/cli.ts';
import { runEconomicsCommand as runMonetaryCommand } from '../../sunrey-chain/src/economics/cli.ts';
import { runSunreyEconomicsCli } from '../../sunrey-chain/src/fees/v2/cli.ts';
import { analyzeReport } from './analysis.ts';
import { runAdversarialSmoke } from './adversarial.ts';
import { compareScenarios } from './compare.ts';
import { renderDashboard } from './dashboard.ts';
import { simulateScenario } from './engine.ts';
import { allPropertiesHold, propertyChecks } from './properties.ts';
import { catalogScenarios, listScenarioIds, loadScenario } from './scenarios.ts';
import { dualEconomyReadiness } from './readiness.ts';
import { runStressCommand } from './stress/cli.ts';

const MONETARY_PLANES = new Set(['supply', 'policy', 'genesis', 'simulate', 'readiness', 'rehearsal']);

const QUALIFY_SCENARIOS = [
  'baseline',
  'rapid-automation',
  'energy-scarcity',
  'compute-abundance',
  'high-concentration',
] as const;

export function runEconomicsCommand(argv: readonly string[]): string {
  const [plane, command, ...rest] = argv;
  if (plane === 'treasury') {
    const result = runTreasuryCommand([command ?? 'help', ...rest]);
    return JSON.stringify(result.payload, (_key, value) => (typeof value === 'bigint' ? value.toString() : value), 2);
  if (plane === 'stress') {
    return runStressCommand([command ?? '', ...rest]);
  }
  if (plane === 'fees') {
    return runSunreyEconomicsCli(argv).trimEnd();
  }
  if (plane && MONETARY_PLANES.has(plane)) {
    const result = runMonetaryCommand(argv);
    return JSON.stringify(result.payload, bigintReplacer, 2);
  }
  if (plane !== 'dual') {
    return usage();
  }
  switch (command) {
    case 'simulate':
      return simulate(rest);
    case 'scenario':
      return scenario(rest);
    case 'compare':
      return compare(rest);
    case 'report':
      return report(rest);
    case 'stability':
      return stability(rest);
    case 'export':
      return exportReport(rest);
    case 'qualify':
      return qualify(rest);
    default:
      return usage();
  }
}

function usage(): string {
  return [
    'sunrey-economics dual simulate --scenario <id> [--seed n] [--epochs n]',
    'sunrey-economics dual scenario [--list] [--id <id>]',
    'sunrey-economics dual compare --left <id> --right <id> [--epochs n]',
    'sunrey-economics dual report --scenario <id>',
    'sunrey-economics dual stability --scenario <id>',
    'sunrey-economics dual export --scenario <id> --out <path>',
    'sunrey-economics dual qualify [--seed n] [--epochs n]',
    'sunrey-economics treasury policy',
    'sunrey-economics treasury reserves',
    'sunrey-economics treasury budgets',
    'sunrey-economics treasury disbursements',
    'sunrey-economics treasury verify',
    'sunrey-economics treasury simulate',
    'sunrey-economics stress run --scenario <id> [--seed n] [--epochs n]',
    'sunrey-economics stress scenario [--list] [--id <id>]',
    'sunrey-economics stress campaign --id <smoke|critical-invariants|compound|extended-12> [--extended]',
    'sunrey-economics stress report --campaign <id>',
    'sunrey-economics stress compare --left <id> --right <id>',
    'sunrey-economics stress replay --scenario <id> --seed n',
    'sunrey-economics policy verify | supply verify | fees <policy|verify>',
  ].join('\n');
}

function flag(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function simulate(args: readonly string[]): string {
  const id = flag(args, '--scenario') ?? 'baseline';
  const seed = flag(args, '--seed');
  const epochs = flag(args, '--epochs');
  const report = simulateScenario(id, {
    ...(seed ? { seed: Number(seed) } : {}),
    ...(epochs ? { epochs: Number(epochs) } : {}),
  });
  return renderDashboard(report);
}

function scenario(args: readonly string[]): string {
  if (args.includes('--list') || !flag(args, '--id')) {
    return catalogScenarios()
      .map((item) => `${item.scenarioId}\t${item.title}\tseed=${item.seed}\tepochs=${item.epochs}`)
      .join('\n');
  }
  return JSON.stringify(loadScenario(flag(args, '--id') ?? 'baseline'), bigintReplacer, 2);
}

function compare(args: readonly string[]): string {
  const left = flag(args, '--left') ?? 'baseline';
  const right = flag(args, '--right') ?? 'rapid-automation';
  const epochs = flag(args, '--epochs');
  return JSON.stringify(compareScenarios(left, right, epochs ? Number(epochs) : undefined), bigintReplacer, 2);
}

function report(args: readonly string[]): string {
  const id = flag(args, '--scenario') ?? 'baseline';
  const simulated = simulateScenario(id);
  return JSON.stringify({ report: simulated, analysis: analyzeReport(simulated), readiness: dualEconomyReadiness() }, bigintReplacer, 2);
}

function stability(args: readonly string[]): string {
  const id = flag(args, '--scenario') ?? 'baseline';
  return JSON.stringify(simulateScenario(id).stability, bigintReplacer, 2);
}

function exportReport(args: readonly string[]): string {
  const id = flag(args, '--scenario') ?? 'baseline';
  const out = flag(args, '--out') ?? `dual-economy-${id}.json`;
  const simulated = simulateScenario(id);
  writeFileSync(out, JSON.stringify(simulated, bigintReplacer, 2));
  return `exported ${out}`;
}

function qualify(args: readonly string[]): string {
  const seed = Number(flag(args, '--seed') ?? '78');
  const epochs = Number(flag(args, '--epochs') ?? '2');
  const reports = QUALIFY_SCENARIOS.map((id) => {
    const report = simulateScenario(id, { seed, epochs });
    return Object.freeze({
      scenarioId: id,
      ok: allPropertiesHold(report.properties),
      sunreySupplyReconciles: report.properties.sunreySupplyReconciles,
    });
  });
  const property = propertyChecks('baseline', seed, epochs);
  const stress = runAdversarialSmoke();
  return JSON.stringify({
    schemaVersion: 1,
    seed,
    epochs,
    scenarios: reports,
    ok: reports.every((row) => row.ok),
    property: { seed, ok: allPropertiesHold(property) },
    stress: {
      ok: stress.failed === 0,
      failed: stress.results.filter((row) => !row.passed).map((row) => row.scenarioId),
      passed: stress.passed,
    },
  }, bigintReplacer);
}

export function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

export function knownScenarioIds(): readonly string[] {
  return listScenarioIds();
}
