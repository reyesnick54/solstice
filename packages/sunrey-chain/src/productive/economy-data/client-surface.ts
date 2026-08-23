/**
 * Client-safe Lovable / BFF / Agent surface for the Productive Economy
 * Data Platform. No provider credentials. No raw restricted data.
 */

import { LOVABLE_CATEGORY_SECTIONS, type LovableCategorySection, type VerificationStatus } from './types.ts';
import { verificationEligibleForValuation } from './verification.ts';
import type { ProductiveEconomyDataPlatform } from './platform.ts';

export const PRODUCTIVE_ECONOMY_CLIENT_SCHEMA = 'sunrey.consumer.productive-economy.v1' as const;

export const AGENT_PRODUCTIVE_ECONOMY_PERMISSIONS = Object.freeze({
  mayExplainProductiveEconomy: true,
  mayRetrieveApprovedMetrics: true,
  mayCompareCategories: true,
  mayExplainMethodology: true,
  mayExplainFreshness: true,
  mayInventData: false,
  mayChangeMethodology: false,
  mayMintMoonRey: false,
  mayPredictGuaranteedMoonReyPrice: false,
});

export type AgentProductiveEconomyAction =
  | 'EXPLAIN'
  | 'READ_METRICS'
  | 'COMPARE_CATEGORIES'
  | 'EXPLAIN_METHODOLOGY'
  | 'EXPLAIN_FRESHNESS'
  | 'INVENT_DATA'
  | 'CHANGE_METHODOLOGY'
  | 'MINT_MOONREY'
  | 'PREDICT_GUARANTEED_PRICE';

export function authorizeAgentProductiveEconomyAction(action: AgentProductiveEconomyAction): {
  readonly ok: boolean;
  readonly code:
    | 'AGENT_READ_ALLOWED'
    | 'AGENT_CANNOT_INVENT_DATA'
    | 'AGENT_CANNOT_CHANGE_METHODOLOGY'
    | 'AGENT_CANNOT_MINT_MOONREY'
    | 'AGENT_CANNOT_PREDICT_PRICE';
} {
  if (action === 'INVENT_DATA') return { ok: false, code: 'AGENT_CANNOT_INVENT_DATA' };
  if (action === 'CHANGE_METHODOLOGY') return { ok: false, code: 'AGENT_CANNOT_CHANGE_METHODOLOGY' };
  if (action === 'MINT_MOONREY') return { ok: false, code: 'AGENT_CANNOT_MINT_MOONREY' };
  if (action === 'PREDICT_GUARANTEED_PRICE') return { ok: false, code: 'AGENT_CANNOT_PREDICT_PRICE' };
  return { ok: true, code: 'AGENT_READ_ALLOWED' };
}

export type LovableCategoryCard = {
  readonly id: LovableCategorySection;
  readonly connected: boolean;
  readonly metric: string | null;
  readonly value: string | null;
  readonly unit: string | null;
  readonly sourceClass: string | null;
  readonly timestampUtc: string | null;
  readonly freshness: string | null;
  readonly verification: VerificationStatus | null;
  readonly trend: 'UP' | 'DOWN' | 'FLAT' | null;
};

export type LovableProductiveEconomyContract = {
  readonly schema: typeof PRODUCTIVE_ECONOMY_CLIENT_SCHEMA;
  readonly productionActive: false;
  readonly simulation: true;
  readonly gpuv: ReturnType<ProductiveEconomyDataPlatform['gpuv']>;
  readonly separation: ReturnType<ProductiveEconomyDataPlatform['separation']>;
  readonly categories: readonly LovableCategoryCard[];
  readonly otherConnected: readonly LovableCategoryCard[];
  readonly sources: readonly {
    readonly source: string;
    readonly freshness: string;
    readonly verification: VerificationStatus;
    readonly license: string;
    readonly rawWithheld: boolean;
  }[];
  readonly moonreyInput: {
    readonly verifiedObservationCount: number;
    readonly gpuvInput: string;
    readonly issuanceProposed: false;
    readonly minted: false;
    readonly marketPriceSet: false;
  };
};

function sectionObservations(platform: ProductiveEconomyDataPlatform, section: LovableCategorySection) {
  if (section === 'OTHER_GOVERNANCE_APPROVED') {
    return platform.observations().filter((row) =>
      row.category === 'WATER' ||
      row.category === 'BANDWIDTH' ||
      row.category === 'TRANSPORTATION' ||
      row.category === 'OTHER_GOVERNANCE_APPROVED',
    );
  }
  return platform.observations(section);
}

function trendOf(values: readonly bigint[]): 'UP' | 'DOWN' | 'FLAT' | null {
  if (values.length < 2) return null;
  const first = values[0]!;
  const last = values[values.length - 1]!;
  if (last > first) return 'UP';
  if (last < first) return 'DOWN';
  return 'FLAT';
}

export function lovableProductiveEconomyContract(
  platform: ProductiveEconomyDataPlatform,
): LovableProductiveEconomyContract {
  const cards = LOVABLE_CATEGORY_SECTIONS.map((id) => {
    const rows = sectionObservations(platform, id).filter(
      (row) =>
        row.license !== 'EXTERNAL_RESTRICTED' &&
        row.license !== 'CONFIDENTIAL_PROVIDER' &&
        verificationEligibleForValuation(row.verification) &&
        row.freshness.usableForTimeSensitiveValuation,
    );
    const latest = rows[0];
    return Object.freeze({
      id,
      connected: latest !== undefined,
      metric: latest?.metric ?? null,
      value: latest?.canonicalValue.toString() ?? null,
      unit: latest?.canonicalUnit ?? null,
      sourceClass: latest?.provenance.sourceClass ?? null,
      timestampUtc: latest?.timestampUtc ?? null,
      freshness: latest?.freshness.state ?? null,
      verification: latest?.verification ?? null,
      trend: trendOf(rows.map((row) => row.canonicalValue)),
    });
  });
  const verified = platform.observations().filter(
    (row) => verificationEligibleForValuation(row.verification) && row.freshness.usableForTimeSensitiveValuation,
  );
  return Object.freeze({
    schema: PRODUCTIVE_ECONOMY_CLIENT_SCHEMA,
    productionActive: false,
    simulation: true,
    gpuv: platform.gpuv(),
    separation: platform.separation(),
    categories: Object.freeze(cards.filter((row) => row.id !== 'OTHER_GOVERNANCE_APPROVED')),
    otherConnected: Object.freeze(cards.filter((row) => row.id === 'OTHER_GOVERNANCE_APPROVED')),
    sources: Object.freeze(
      platform.publicMetrics().map((row) =>
        Object.freeze({
          source: row.sourceClass,
          freshness: row.freshness,
          verification: (platform.observations().find((item) => item.observationId === row.observationId)?.verification ??
            'INVALID') as VerificationStatus,
          license: row.rawWithheld ? 'WITHHELD' : 'SANDBOX_FIXTURE',
          rawWithheld: row.rawWithheld,
        }),
      ),
    ),
    moonreyInput: Object.freeze({
      verifiedObservationCount: verified.length,
      gpuvInput: platform.separation().productiveEconomicValue.input,
      issuanceProposed: false,
      minted: false,
      marketPriceSet: false,
    }),
  });
}

export function categoryBreakdown(platform: ProductiveEconomyDataPlatform) {
  return lovableProductiveEconomyContract(platform).categories;
}

export function metricHistory(platform: ProductiveEconomyDataPlatform, category?: string) {
  return platform
    .observations()
    .filter((row) => !category || row.category === category)
    .filter((row) => row.license !== 'EXTERNAL_RESTRICTED' && row.license !== 'CONFIDENTIAL_PROVIDER')
    .map((row) =>
      Object.freeze({
        observationId: row.observationId,
        category: row.category,
        metric: row.metric,
        value: row.canonicalValue.toString(),
        unit: row.canonicalUnit,
        timestampUtc: row.timestampUtc,
        freshness: row.freshness.state,
        verification: row.verification,
      }),
    );
}

export function sourceFreshnessSummary(platform: ProductiveEconomyDataPlatform) {
  return lovableProductiveEconomyContract(platform).sources;
}

export function moonreyEconomicInputSummary(platform: ProductiveEconomyDataPlatform) {
  return lovableProductiveEconomyContract(platform).moonreyInput;
}
