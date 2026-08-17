/**
 * sunrey-economics stress CLI.
 */

import { campaignById, catalogScenarioIds, ECONOMIC_STRESS_CATALOG, scenarioById, STRESS_CAMPAIGNS } from './catalog.ts';
import { compareStressScenarios } from './compare.ts';
import { runEconomicStressScenario } from './engine.ts';
import { runStressCampaign } from './campaign.ts';
import { renderStressReport } from './report.ts';
import { replayStressScenario } from './replay.ts';

export function runStressCommand(argv: readonly string[]): string {
  const [command, ...rest] = argv;
  switch (command) {
    case 'run':
      return run(rest);
    case 'scenario':
      return scenario(rest);
    case 'campaign':
      return campaign(rest);
    case 'report':
      return report(rest);
    case 'compare':
      return compare(rest);
    case 'replay':
      return replay(rest);
    default:
      return usage();
  }
}

function usage(): string {
  return [
    'sunrey-economics stress run --scenario <id> [--seed n] [--epochs n]',
    'sunrey-economics stress scenario [--list] [--id <id>]',
    'sunrey-economics stress campaign --id <smoke|critical-invariants|compound|extended-12> [--extended]',
    'sunrey-economics stress report --campaign <id>',
    'sunrey-economics stress compare --left <id> --right <id>',
    'sunrey-economics stress replay --scenario <id> --seed n [--fixture <hash>]',
  ].join('\n');
}

function flag(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function run(args: readonly string[]): string {
  const id = flag(args, '--scenario') ?? 'ECON-LIQ-001';
  const seed = flag(args, '--seed');
  const epochs = flag(args, '--epochs');
  const result = runEconomicStressScenario(id, {
    ...(seed ? { seed: Number(seed) } : {}),
    ...(epochs ? { epochs: Number(epochs) } : {}),
  });
  return JSON.stringify(result, bigintReplacer, 2);
}

function scenario(args: readonly string[]): string {
  if (args.includes('--list') || !flag(args, '--id')) {
    return ECONOMIC_STRESS_CATALOG.map((row) => `${row.scenarioId}\t${row.domain}\t${row.title}`).join('\n');
  }
  return JSON.stringify(scenarioById(flag(args, '--id') ?? 'ECON-LIQ-001'), bigintReplacer, 2);
}

function campaign(args: readonly string[]): string {
  const id = flag(args, '--id') ?? 'smoke';
  const report = runStressCampaign(id, { allowExtended: args.includes('--extended') });
  return renderStressReport(report);
}

function report(args: readonly string[]): string {
  const id = flag(args, '--campaign') ?? 'smoke';
  const generated = runStressCampaign(id, { allowExtended: args.includes('--extended') });
  return JSON.stringify(generated, bigintReplacer, 2);
}

function compare(args: readonly string[]): string {
  return JSON.stringify(compareStressScenarios(flag(args, '--left') ?? 'ECON-LIQ-001', flag(args, '--right') ?? 'ECON-COMP-001'), null, 2);
}

function replay(args: readonly string[]): string {
  const result = replayStressScenario({
    scenarioId: flag(args, '--scenario') ?? 'ECON-LIQ-001',
    seed: Number(flag(args, '--seed') ?? '7601'),
    ...(flag(args, '--fixture') ? { expectedFixtureHash: flag(args, '--fixture') } : {}),
  });
  return JSON.stringify(result, bigintReplacer, 2);
}

export function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

export function knownStressScenarioIds(): readonly string[] {
  return catalogScenarioIds();
}

export function knownCampaignIds(): readonly string[] {
  return STRESS_CAMPAIGNS.map((row) => row.campaignId);
}

export { campaignById };
