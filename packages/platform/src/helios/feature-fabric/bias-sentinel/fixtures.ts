/**
 * Intentionally biased research universes for AAFV2.5 qualification and tests.
 */

import type { UniverseMemberProfile } from './types.ts';

function baseMember(id: string, overrides: Partial<UniverseMemberProfile> = {}): UniverseMemberProfile {
  return Object.freeze({
    canonicalEntityId: id,
    marketCapMinor: overrides.marketCapMinor ?? 5_000_000_000n,
    liquidityScore: overrides.liquidityScore ?? 5_000,
    volatilityBps: overrides.volatilityBps ?? 1_200,
    sector: overrides.sector ?? 'TECH',
    industry: overrides.industry ?? 'SOFTWARE',
    geography: overrides.geography ?? 'US',
    jurisdiction: overrides.jurisdiction ?? 'US',
    venue: overrides.venue ?? 'NYSE',
    assetClass: overrides.assetClass ?? 'EQUITY',
    listingAgeDays: overrides.listingAgeDays ?? 1_500,
    assetAgeDays: overrides.assetAgeDays ?? 1_500,
    historicalReturnBps: overrides.historicalReturnBps ?? 400,
    primaryProviderId: overrides.primaryProviderId ?? 'provider_a',
    featureCoverageRateBps: overrides.featureCoverageRateBps ?? 10_000,
    delisted: overrides.delisted ?? false,
    delistedBeforeEvaluation: overrides.delistedBeforeEvaluation ?? false,
    hadCorporateActionInWindow: overrides.hadCorporateActionInWindow ?? false,
  });
}

export function buildCleanControlUniverse(count = 40): UniverseMemberProfile[] {
  const rows: UniverseMemberProfile[] = [];
  for (let i = 0; i < count; i += 1) {
    rows.push(
      baseMember(`clean_${i}`, {
        marketCapMinor: i % 2 === 0 ? 20_000_000_000n : 3_000_000_000n,
        sector: i % 3 === 0 ? 'TECH' : i % 3 === 1 ? 'HEALTH' : 'FIN',
        geography: i % 2 === 0 ? 'US' : 'EU',
        primaryProviderId: i % 2 === 0 ? 'provider_a' : 'provider_b',
      }),
    );
  }
  return rows;
}

export function observedIdsForCleanControl(universe: readonly UniverseMemberProfile[]): string[] {
  return universe.map((row) => row.canonicalEntityId);
}

/** Mega-cap names retain alternative data; small caps drop out. */
export function buildMegaCapAltDataBiasUniverse(): {
  readonly intended: readonly UniverseMemberProfile[];
  readonly observedIds: readonly string[];
} {
  const intended: UniverseMemberProfile[] = [];
  for (let i = 0; i < 40; i += 1) {
    const mega = i < 20;
    intended.push(
      baseMember(`mega_${i}`, {
        marketCapMinor: mega ? 80_000_000_000n : 400_000_000n,
        liquidityScore: mega ? 9_500 : 1_200,
        featureCoverageRateBps: mega ? 10_000 : 0,
      }),
    );
  }
  const observedIds = intended
    .filter((row) => (row.marketCapMinor ?? 0n) >= 10_000_000_000n)
    .map((row) => row.canonicalEntityId);
  return Object.freeze({ intended: Object.freeze(intended), observedIds: Object.freeze(observedIds) });
}

/** Failing / delisted companies disappear from usable history. */
export function buildSurvivorshipBiasUniverse(): {
  readonly intended: readonly UniverseMemberProfile[];
  readonly observedIds: readonly string[];
} {
  const intended: UniverseMemberProfile[] = buildCleanControlUniverse(35);
  const delisted = [
    baseMember('fail_1', {
      delistedBeforeEvaluation: true,
      delisted: true,
      sector: 'RETAIL',
      marketCapMinor: 200_000_000n,
      liquidityScore: 400,
    }),
    baseMember('fail_2', {
      delistedBeforeEvaluation: true,
      delisted: true,
      sector: 'RETAIL',
      marketCapMinor: 150_000_000n,
      liquidityScore: 300,
    }),
    baseMember('fail_3', {
      delistedBeforeEvaluation: true,
      delisted: true,
      sector: 'ENERGY',
      marketCapMinor: 900_000_000n,
      liquidityScore: 800,
    }),
    baseMember('fail_4', {
      delistedBeforeEvaluation: true,
      delisted: true,
      sector: 'TECH',
      marketCapMinor: 600_000_000n,
      liquidityScore: 600,
    }),
    baseMember('fail_5', {
      delistedBeforeEvaluation: true,
      delisted: true,
      sector: 'FIN',
      marketCapMinor: 700_000_000n,
      liquidityScore: 700,
    }),
  ];
  const full = [...intended, ...delisted];
  const observedIds = intended.map((row) => row.canonicalEntityId);
  return Object.freeze({ intended: Object.freeze(full), observedIds: Object.freeze(observedIds) });
}

/** Technology sector coverage doubles in observed universe. */
export function buildSectorTechDoublingUniverse(): {
  readonly intended: readonly UniverseMemberProfile[];
  readonly observedIds: readonly string[];
} {
  const intended = buildCleanControlUniverse(40);
  const tech = intended.filter((row) => row.sector === 'TECH');
  const nonTechObserved = intended.filter((row) => row.sector !== 'TECH').slice(0, 8);
  const observedIds = [...tech.map((row) => row.canonicalEntityId), ...nonTechObserved.map((row) => row.canonicalEntityId)];
  return Object.freeze({ intended: Object.freeze(intended), observedIds: Object.freeze(observedIds) });
}

/** One provider covers mostly US names. */
export function buildProviderUsBiasUniverse(): {
  readonly intended: readonly UniverseMemberProfile[];
  readonly observedIds: readonly string[];
} {
  const intended: UniverseMemberProfile[] = [];
  for (let i = 0; i < 40; i += 1) {
    const us = i < 25;
    intended.push(
      baseMember(`prov_${i}`, {
        geography: us ? 'US' : 'APAC',
        primaryProviderId: 'provider_us_heavy',
      }),
    );
  }
  const observedIds = intended
    .filter((row) => row.geography === 'US' || row.primaryProviderId === 'provider_us_heavy')
    .slice(0, 28)
    .map((row) => row.canonicalEntityId);
  return Object.freeze({ intended: Object.freeze(intended), observedIds: Object.freeze(observedIds) });
}

/** Illiquid companies systematically missing. */
export function buildLiquidityBiasUniverse(): {
  readonly intended: readonly UniverseMemberProfile[];
  readonly observedIds: readonly string[];
} {
  const intended: UniverseMemberProfile[] = [];
  for (let i = 0; i < 40; i += 1) {
    const liquid = i < 18;
    intended.push(
      baseMember(`liq_${i}`, {
        liquidityScore: liquid ? 8_000 : 900,
        marketCapMinor: liquid ? 12_000_000_000n : 800_000_000n,
      }),
    );
  }
  const observedIds = intended
    .filter((row) => (row.liquidityScore ?? 0) >= 5_000)
    .map((row) => row.canonicalEntityId);
  return Object.freeze({ intended: Object.freeze(intended), observedIds: Object.freeze(observedIds) });
}

/** Delisted securities omitted from observed usable set. */
export function buildDelistingOmissionUniverse(): {
  readonly intended: readonly UniverseMemberProfile[];
  readonly observedIds: readonly string[];
} {
  const { intended, observedIds } = buildSurvivorshipBiasUniverse();
  return Object.freeze({ intended, observedIds });
}

/** Corporate-action names disproportionately missing. */
export function buildCorporateActionBiasUniverse(): {
  readonly intended: readonly UniverseMemberProfile[];
  readonly observedIds: readonly string[];
} {
  const intended = buildCleanControlUniverse(36);
  const corp = [
    baseMember('corp_1', { hadCorporateActionInWindow: true, sector: 'TECH' }),
    baseMember('corp_2', { hadCorporateActionInWindow: true, sector: 'HEALTH' }),
    baseMember('corp_3', { hadCorporateActionInWindow: true, sector: 'FIN' }),
    baseMember('corp_4', { hadCorporateActionInWindow: true, sector: 'ENERGY' }),
  ];
  const full = [...intended, ...corp];
  const observedIds = intended.map((row) => row.canonicalEntityId);
  return Object.freeze({ intended: Object.freeze(full), observedIds: Object.freeze(observedIds) });
}
