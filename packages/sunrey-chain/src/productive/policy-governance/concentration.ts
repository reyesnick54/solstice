import type { ConcentrationReport } from '../../oracle/production/concentration.ts';
import type { ProductiveCategory } from '../types.ts';

export type ConcentrationWarning = {
  readonly kind:
    | 'CATEGORY_DOMINANCE'
    | 'OPERATOR_CONCENTRATION'
    | 'ORACLE_CONTROLLER_CONCENTRATION'
    | 'OBJECT_CLASS_CONCENTRATION'
    | 'REGION_CONCENTRATION';
  readonly subject: string;
  readonly shareBps: bigint;
  readonly warnAtBps: number;
};

export type IssuanceConcentrationInput = {
  readonly issuanceByCategory: Readonly<Record<string, bigint>>;
  readonly issuanceByOperator: Readonly<Record<string, bigint>>;
  readonly issuanceByObjectClass: Readonly<Record<string, bigint>>;
  readonly issuanceByRegion: Readonly<Record<string, bigint>>;
  readonly totalIssuance: bigint;
  readonly warnAtBps: number;
  readonly oracleConcentration?: ConcentrationReport;
};

export function analyzeIssuanceConcentration(input: IssuanceConcentrationInput): readonly ConcentrationWarning[] {
  const warnings: ConcentrationWarning[] = [];
  if (input.totalIssuance <= 0n) {
    return Object.freeze(warnings);
  }
  pushShareWarnings(warnings, 'CATEGORY_DOMINANCE', input.issuanceByCategory, input.totalIssuance, input.warnAtBps);
  pushShareWarnings(warnings, 'OPERATOR_CONCENTRATION', input.issuanceByOperator, input.totalIssuance, input.warnAtBps);
  pushShareWarnings(warnings, 'OBJECT_CLASS_CONCENTRATION', input.issuanceByObjectClass, input.totalIssuance, input.warnAtBps);
  pushShareWarnings(warnings, 'REGION_CONCENTRATION', input.issuanceByRegion, input.totalIssuance, input.warnAtBps);
  if (input.oracleConcentration) {
    for (const share of input.oracleConcentration.controller) {
      if (share.shareBps >= input.warnAtBps) {
        warnings.push({
          kind: 'ORACLE_CONTROLLER_CONCENTRATION',
          subject: share.key,
          shareBps: BigInt(share.shareBps),
          warnAtBps: input.warnAtBps,
        });
      }
    }
    for (const alert of input.oracleConcentration.warnings) {
      warnings.push({
        kind: 'ORACLE_CONTROLLER_CONCENTRATION',
        subject: alert.detail,
        shareBps: 0n,
        warnAtBps: input.warnAtBps,
      });
    }
  }
  return Object.freeze(warnings);
}

export function categoryShareBps(
  issuanceByCategory: Readonly<Record<string, bigint>>,
  total: bigint,
  category: ProductiveCategory,
): bigint {
  if (total <= 0n) {
    return 0n;
  }
  return ((issuanceByCategory[category] ?? 0n) * 10_000n) / total;
}

function pushShareWarnings(
  warnings: ConcentrationWarning[],
  kind: ConcentrationWarning['kind'],
  shares: Readonly<Record<string, bigint>>,
  total: bigint,
  warnAtBps: number,
): void {
  for (const [subject, quantity] of Object.entries(shares)) {
    const shareBps = (quantity * 10_000n) / total;
    if (shareBps >= BigInt(warnAtBps)) {
      warnings.push({ kind, subject, shareBps, warnAtBps });
    }
  }
}

