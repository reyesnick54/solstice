/**
 * Versioned HIN valuation methodology registry.
 *
 * Economic coefficients live here as data. They are engineering
 * simulation parameters and are not production tokenomics.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import { HIN_PRODUCT_CATEGORIES, type HinProductCategory } from './categories.ts';
import { HIN_ECONOMIC_VALUE_INPUT_UNIT } from './types.ts';
import type { HinVerificationState } from './verification.ts';

export const HIN_METHODOLOGY_REGISTRY_ID = 'sunrey-hin-valuation-methodologies' as const;
export const HIN_METHODOLOGY_REGISTRY_VERSION = '1' as const;

export const HIN_METHODOLOGY_GOVERNANCE_STATUSES = [
  'SIMULATION_APPROVED',
  'RESEARCH_REQUIRED',
  'NOT_AUTHORIZED_FOR_PRODUCTION',
] as const;
export type HinMethodologyGovernanceStatus = (typeof HIN_METHODOLOGY_GOVERNANCE_STATUSES)[number];

export type HinMethodologyCaps = {
  readonly perEvent: bigint;
  readonly perCategoryPeriod: bigint;
  readonly perSubjectPeriod: bigint;
};

export type HinMethodologyRecord = {
  readonly methodologyId: string;
  readonly version: string;
  readonly eligibleCategories: readonly HinProductCategory[];
  readonly inputs: readonly ['quantity', 'qualityBps', 'confidenceBps', 'verificationState'];
  readonly units: typeof HIN_ECONOMIC_VALUE_INPUT_UNIT;
  readonly normalization: {
    readonly quantityScaleNumerator: bigint;
    readonly quantityScaleDenominator: bigint;
  };
  readonly caps: HinMethodologyCaps;
  readonly confidenceTreatment: {
    readonly minBps: bigint;
    readonly weightBps: bigint;
  };
  readonly qualityWeighting: {
    readonly minBps: bigint;
    readonly weightBps: bigint;
  };
  readonly verificationWeightsBps: Readonly<Record<HinVerificationState, bigint>>;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveUntil: UtcInstant | null;
  readonly governanceApprovalStatus: HinMethodologyGovernanceStatus;
  readonly productionAuthorized: false;
  readonly parameterClass: 'ENGINEERING_SIMULATION_PARAMETERS';
};

export const DEFAULT_HIN_METHODOLOGY_ID = 'hin-evi-governed-schedule' as const;
export const DEFAULT_HIN_METHODOLOGY_VERSION = '1' as const;

export function defaultHinMethodology(): HinMethodologyRecord {
  return Object.freeze({
    methodologyId: DEFAULT_HIN_METHODOLOGY_ID,
    version: DEFAULT_HIN_METHODOLOGY_VERSION,
    eligibleCategories: HIN_PRODUCT_CATEGORIES,
    inputs: Object.freeze(['quantity', 'qualityBps', 'confidenceBps', 'verificationState'] as const),
    units: HIN_ECONOMIC_VALUE_INPUT_UNIT,
    normalization: Object.freeze({
      quantityScaleNumerator: 100n,
      quantityScaleDenominator: 1n,
    }),
    caps: Object.freeze({
      perEvent: 10_000n,
      perCategoryPeriod: 50_000n,
      perSubjectPeriod: 100_000n,
    }),
    confidenceTreatment: Object.freeze({
      minBps: 5_000n,
      weightBps: 10_000n,
    }),
    qualityWeighting: Object.freeze({
      minBps: 4_000n,
      weightBps: 10_000n,
    }),
    verificationWeightsBps: Object.freeze({
      UNVERIFIED: 0n,
      SELF_DECLARED: 2_500n,
      SOURCE_VERIFIED: 7_000n,
      SYSTEM_VERIFIED: 10_000n,
      DISPUTED: 0n,
      INVALIDATED: 0n,
    }),
    effectiveFrom: '2026-08-19T00:00:00.000Z' as UtcInstant,
    effectiveUntil: null,
    governanceApprovalStatus: 'SIMULATION_APPROVED',
    productionAuthorized: false,
    parameterClass: 'ENGINEERING_SIMULATION_PARAMETERS',
  });
}

export class HinValuationMethodologyRegistry {
  private readonly byKey = new Map<string, HinMethodologyRecord>();

  constructor(seed: readonly HinMethodologyRecord[] = [defaultHinMethodology()]) {
    for (const methodology of seed) {
      this.register(methodology);
    }
  }

  register(methodology: HinMethodologyRecord): void {
    if (methodology.normalization.quantityScaleDenominator <= 0n) {
      throw new TypeError('methodology denominator must be positive');
    }
    this.byKey.set(`${methodology.methodologyId}:${methodology.version}`, Object.freeze({ ...methodology }));
  }

  get(methodologyId: string, version: string): HinMethodologyRecord | undefined {
    return this.byKey.get(`${methodologyId}:${version}`);
  }

  active(at: UtcInstant = defaultHinMethodology().effectiveFrom): HinMethodologyRecord {
    const current = this.get(DEFAULT_HIN_METHODOLOGY_ID, DEFAULT_HIN_METHODOLOGY_VERSION) ?? defaultHinMethodology();
    if (current.effectiveFrom > at) {
      return current;
    }
    if (current.effectiveUntil && current.effectiveUntil < at) {
      return current;
    }
    return current;
  }

  listPublicMetadata(): readonly {
    readonly methodologyId: string;
    readonly version: string;
    readonly eligibleCategories: readonly HinProductCategory[];
    readonly units: typeof HIN_ECONOMIC_VALUE_INPUT_UNIT;
    readonly governanceApprovalStatus: HinMethodologyGovernanceStatus;
    readonly effectiveFrom: UtcInstant;
    readonly effectiveUntil: UtcInstant | null;
    readonly productionAuthorized: false;
    readonly isMintFormula: false;
  }[] {
    return Object.freeze(
      [...this.byKey.values()].map((row) =>
        Object.freeze({
          methodologyId: row.methodologyId,
          version: row.version,
          eligibleCategories: row.eligibleCategories,
          units: row.units,
          governanceApprovalStatus: row.governanceApprovalStatus,
          effectiveFrom: row.effectiveFrom,
          effectiveUntil: row.effectiveUntil,
          productionAuthorized: false as const,
          isMintFormula: false as const,
        }),
      ),
    );
  }
}
