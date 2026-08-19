/**
 * demo:moonrey-v2-shadow-economics
 */

import { MoonReyEconomicShadowEvaluator } from './evaluator.ts';
import {
  CANONICAL_SUPPLY_MUTATED,
  LEGACY_V1_REMOVED,
  PRODUCTION_MIGRATION_APPROVED,
  SHADOW_MODE,
  V2_PRODUCTION_ACTIVE,
} from './identities.ts';
import { representativeScenarioLibrary } from './scenarios.ts';

export function runMoonreyV2ShadowEconomicsDemo(): string {
  const evaluator = new MoonReyEconomicShadowEvaluator();
  const scenarios = representativeScenarioLibrary();
  const comparisons = evaluator.evaluateMany(scenarios);
  const header = pad([
    'Category',
    'V1 Candidate',
    'V2 GPUV',
    'V2 MoonRey Candidate',
    'Delta',
    'Attribution',
    'Warnings',
  ]);
  const rows = comparisons.map((row) =>
    pad([
      row.category,
      formatQty(row.v1Quantity),
      formatQty(row.v2GpuvValue),
      formatQty(row.v2MoonReyCandidateQuantity),
      formatQty(row.absoluteDelta),
      `${row.attributionShare.numerator.toString()}/${row.attributionShare.denominator.toString()}`,
      row.warnings[0] ?? (row.v2Valued ? '' : row.reasonCodes.filter((code) => code.startsWith('V2_')).join(',')),
    ]),
  );
  const lines = [
    'MoonRey governed-value V2 shadow evaluation (Chunk 126)',
    header,
    ...rows,
    '',
    `SHADOW_MODE=${String(SHADOW_MODE)}`,
    `CANONICAL_SUPPLY_MUTATED=${String(CANONICAL_SUPPLY_MUTATED)}`,
    `V2_PRODUCTION_ACTIVE=${String(V2_PRODUCTION_ACTIVE)}`,
    `LEGACY_V1_REMOVED=${String(LEGACY_V1_REMOVED)}`,
    `PRODUCTION_MIGRATION_APPROVED=${String(PRODUCTION_MIGRATION_APPROVED)}`,
  ];
  return lines.join('\n');
}

function formatQty(value: bigint | null): string {
  return value === null ? 'UNVALUED' : value.toString();
}

function pad(columns: readonly string[]): string {
  const widths = [28, 16, 14, 22, 14, 18, 36];
  return columns.map((column, index) => column.padEnd(widths[index] ?? 16)).join(' ');
}

const invoked = process.argv[1]?.includes('shadow-economics/demo');
if (invoked) {
  console.log(runMoonreyV2ShadowEconomicsDemo());
}
