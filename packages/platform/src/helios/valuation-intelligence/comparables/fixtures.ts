import type { UtcInstant } from '@solstice/domain';

import type { PeerCandidate, ProbabilisticComparablesInput } from './types.ts';
import { DEFAULT_VAL08_SEED } from './taxonomy.ts';

export const FIXTURE_VAL08_VALUATION_TIME = '2020-06-30T00:00:00.000Z' as UtcInstant;

function peer(
  id: string,
  label: string,
  knowableAt: UtcInstant,
  overrides: Partial<Omit<PeerCandidate, 'peerId' | 'label' | 'knowableAt'>> = {},
): PeerCandidate {
  return Object.freeze({
    peerId: id,
    label,
    knowableAt,
    listingActiveAt: '2015-01-01T00:00:00.000Z' as UtcInstant,
    classification: Object.freeze({
      sector: 'Technology',
      industry: 'Software',
      subindustry: 'Application Software',
      businessModel: 'SaaS',
      geography: 'US',
      currency: 'USD',
      ...overrides.classification,
    }),
    market: Object.freeze({
      marketCap: 10_000_000_000,
      enterpriseValue: 10_500_000_000,
      price: 100,
      beta: 1.1,
      factorExposures: Object.freeze({ momentum: 0.2, value: -0.1, size: -0.3 }),
      ...overrides.market,
    }),
    fundamentals: Object.freeze({
      revenue: 2_000_000_000,
      netIncome: 300_000_000,
      ebit: 400_000_000,
      ebitda: 500_000_000,
      fcf: 350_000_000,
      bookEquity: 1_500_000_000,
      investedCapital: 2_200_000_000,
      forwardEps: 3.2,
      sharesOutstanding: 100_000_000,
      grossMargin: 0.72,
      operatingMargin: 0.22,
      ebitdaMargin: 0.25,
      fcfMargin: 0.175,
      roic: 0.18,
      revenueGrowth: 0.12,
      capitalIntensity: 0.35,
      leverage: 0.25,
      assetIntensity: 0.4,
      cyclicality: 0.35,
      customerConcentration: 0.15,
      revenueRecurrence: 0.85,
      ...overrides.fundamentals,
    }),
    accountingRegime: overrides.accountingRegime ?? 'US_GAAP',
    countryCode: overrides.countryCode ?? 'US',
    countryRiskPremiumBps: overrides.countryRiskPremiumBps ?? 0,
    taxStructureLabel: overrides.taxStructureLabel ?? 'US_C_CORP',
  });
}

export function fixtureVal08Target(): PeerCandidate {
  return peer('target-co', 'Target Co', '2020-06-01T00:00:00.000Z' as UtcInstant, {
    market: { marketCap: 8_000_000_000, enterpriseValue: 8_400_000_000, price: 80, beta: 1.05 },
    fundamentals: {
      revenue: 1_500_000_000,
      netIncome: 220_000_000,
      sharesOutstanding: 90_000_000,
      revenueGrowth: 0.14,
      operatingMargin: 0.2,
    },
  });
}

export function fixtureVal08PeerUniverse(): readonly PeerCandidate[] {
  const t = FIXTURE_VAL08_VALUATION_TIME;
  return Object.freeze([
    peer('peer-a', 'Peer A', '2020-06-15T00:00:00.000Z' as UtcInstant, {
      market: { marketCap: 12_000_000_000, enterpriseValue: 12_500_000_000, beta: 1.0 },
      fundamentals: { revenue: 2_200_000_000, sharesOutstanding: 110_000_000, revenueGrowth: 0.11, operatingMargin: 0.21 },
    }),
    peer('peer-b', 'Peer B', '2020-05-20T00:00:00.000Z' as UtcInstant, {
      market: { marketCap: 9_000_000_000, enterpriseValue: 9_200_000_000, beta: 1.15 },
      fundamentals: { revenue: 1_800_000_000, sharesOutstanding: 95_000_000, revenueGrowth: 0.09, operatingMargin: 0.19 },
    }),
    peer('peer-c', 'Peer C', '2020-06-10T00:00:00.000Z' as UtcInstant, {
      market: { marketCap: 15_000_000_000, enterpriseValue: 15_800_000_000, beta: 0.95 },
      fundamentals: { revenue: 2_800_000_000, sharesOutstanding: 120_000_000, revenueGrowth: 0.13, operatingMargin: 0.24 },
    }),
    peer('peer-future-leak', 'Future Leak', '2021-01-01T00:00:00.000Z' as UtcInstant),
    peer('peer-ifrs', 'IFRS Peer', t, {
      accountingRegime: 'IFRS',
      countryCode: 'GB',
      countryRiskPremiumBps: 75,
      classification: { geography: 'GB', currency: 'GBP' },
    }),
    peer('peer-outlier', 'Outlier Peer', t, {
      market: { marketCap: 20_000_000_000, enterpriseValue: 21_000_000_000 },
      fundamentals: {
        revenue: 1_200_000_000,
        sharesOutstanding: 75_000_000,
        netIncome: 50_000_000,
        ebitda: 200_000_000,
      },
    }),
  ]);
}

export function fixtureProbabilisticComparablesInput(): ProbabilisticComparablesInput {
  return Object.freeze({
    valuationId: 'val08-fixture-001',
    entityLabel: 'Target Co',
    valuationTimeUtc: FIXTURE_VAL08_VALUATION_TIME,
    target: fixtureVal08Target(),
    universe: fixtureVal08PeerUniverse(),
    seed: DEFAULT_VAL08_SEED,
    maxPeers: 5,
    regimeLabel: 'mid_cycle',
    enableCopula: true,
  });
}
