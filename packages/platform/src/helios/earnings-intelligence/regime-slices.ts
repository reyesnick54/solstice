import type { EarningsRegimeSlice } from './taxonomy.ts';
import type { LabeledEarningsOutcome } from './benchmarks.ts';
import type { RegimeSliceReport } from './types.ts';
import { runEarningsBenchmark } from './benchmarks.ts';
import type { EarningsIssuerProfile } from './types.ts';

export type RegimeTaggedOutcome = LabeledEarningsOutcome & {
  readonly issuer: EarningsIssuerProfile;
  readonly marketRegime: 'BULL' | 'BEAR';
  readonly preMajorRegime: boolean;
};

function matchesSlice(row: RegimeTaggedOutcome, slice: EarningsRegimeSlice, sectorKey?: string): boolean {
  switch (slice) {
    case 'LARGE_CAP':
      return row.issuer.marketCapTier === 'LARGE';
    case 'MID_CAP':
      return row.issuer.marketCapTier === 'MID';
    case 'SMALL_CAP':
      return row.issuer.marketCapTier === 'SMALL';
    case 'HIGH_ANALYST_COVERAGE':
      return row.issuer.analystCoverageScore >= 70;
    case 'LOW_ANALYST_COVERAGE':
      return row.issuer.analystCoverageScore < 70;
    case 'HIGH_LIQUIDITY':
      return row.issuer.liquidityScore >= 65;
    case 'LOW_LIQUIDITY':
      return row.issuer.liquidityScore < 65;
    case 'BULL':
      return row.marketRegime === 'BULL';
    case 'BEAR':
      return row.marketRegime === 'BEAR';
    case 'HIGH_VOLATILITY':
      return row.issuer.volatilityBps >= 2_000;
    case 'LOW_VOLATILITY':
      return row.issuer.volatilityBps < 2_000;
    case 'SECTOR':
      return sectorKey ? row.issuer.sector === sectorKey : true;
    case 'PRE_MAJOR_REGIME':
      return row.preMajorRegime;
    case 'POST_MAJOR_REGIME':
      return !row.preMajorRegime;
    default:
      return false;
  }
}

export function buildRegimeSliceReports(
  rows: readonly RegimeTaggedOutcome[],
  sectors: readonly string[],
): readonly RegimeSliceReport[] {
  const slices: { slice: EarningsRegimeSlice; key: string }[] = [
    { slice: 'LARGE_CAP', key: 'ALL' },
    { slice: 'MID_CAP', key: 'ALL' },
    { slice: 'SMALL_CAP', key: 'ALL' },
    { slice: 'HIGH_ANALYST_COVERAGE', key: 'ALL' },
    { slice: 'LOW_ANALYST_COVERAGE', key: 'ALL' },
    { slice: 'HIGH_LIQUIDITY', key: 'ALL' },
    { slice: 'LOW_LIQUIDITY', key: 'ALL' },
    { slice: 'BULL', key: 'ALL' },
    { slice: 'BEAR', key: 'ALL' },
    { slice: 'HIGH_VOLATILITY', key: 'ALL' },
    { slice: 'LOW_VOLATILITY', key: 'ALL' },
    { slice: 'PRE_MAJOR_REGIME', key: 'ALL' },
    { slice: 'POST_MAJOR_REGIME', key: 'ALL' },
    ...sectors.map((sector) => ({ slice: 'SECTOR' as const, key: sector })),
  ];

  return Object.freeze(
    slices.map(({ slice, key }) => {
      const filtered = rows.filter((row) => matchesSlice(row, slice, key === 'ALL' ? undefined : key));
      const bench =
        filtered.length > 0
          ? runEarningsBenchmark('HELIOS_FULL_STACK', filtered, {
              epsMinor: filtered[0]!.epsConsensusMinor,
              revenueMinor: filtered[0]!.revenueConsensusMinor,
              beatProbabilityBps: 5_000,
              intervalLowEpsMinor: filtered[0]!.epsConsensusMinor - 2n,
              intervalHighEpsMinor: filtered[0]!.epsConsensusMinor + 2n,
            })
          : runEarningsBenchmark('CONSENSUS_ONLY', []);
      return Object.freeze({
        slice,
        sliceKey: key,
        eventCount: filtered.length,
        forecast: bench.forecast,
        investment: bench.investment,
      });
    }),
  );
}
