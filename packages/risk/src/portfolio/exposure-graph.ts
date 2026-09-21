import { shareOf, type Ratio } from '../arithmetic.ts';
import type {
  AssetClassTag,
  ClusterExposureFact,
  InstrumentRiskProfile,
  PortfolioExposureAssessment,
  PortfolioPositionRiskFact,
  StrategyExposureFact,
  VenueExposureFact,
} from './types.ts';

function profileFor(
  instrumentId: string,
  profiles: readonly InstrumentRiskProfile[],
): InstrumentRiskProfile | undefined {
  return profiles.find((row) => row.instrumentId === instrumentId);
}

export function buildExposureGraph(input: {
  readonly positions: readonly PortfolioPositionRiskFact[];
  readonly profiles: readonly InstrumentRiskProfile[];
  readonly totalEquityMinor: bigint;
}): PortfolioExposureAssessment {
  const strategyMap = new Map<string, StrategyExposureFact>();
  const venueMap = new Map<string, bigint>();
  const classMap = new Map<AssetClassTag, bigint>();
  const clusterMembers = new Map<string, Set<string>>();
  const clusterExposure = new Map<string, bigint>();

  let gross = 0n;
  let net = 0n;

  for (const position of input.positions) {
    const abs = position.marketValueMinor < 0n ? -position.marketValueMinor : position.marketValueMinor;
    gross += abs;
    net += position.signedExposureMinor;

    const profile = profileFor(position.instrumentId, input.profiles);
    const assetClass = profile?.assetClass ?? position.assetClass;
    const venue = profile?.venue ?? position.venue;
    const strategyId = profile?.strategyId ?? position.strategyId ?? 'UNASSIGNED';

    classMap.set(assetClass, (classMap.get(assetClass) ?? 0n) + abs);
    venueMap.set(venue, (venueMap.get(venue) ?? 0n) + abs);

    const currentStrategy = strategyMap.get(strategyId);
    if (currentStrategy) {
      strategyMap.set(strategyId, Object.freeze({
        strategyId,
        grossExposureMinor: currentStrategy.grossExposureMinor + abs,
        netExposureMinor: currentStrategy.netExposureMinor + position.signedExposureMinor,
        marketValueMinor: currentStrategy.marketValueMinor + position.marketValueMinor,
      }));
    } else {
      strategyMap.set(strategyId, Object.freeze({
        strategyId,
        grossExposureMinor: abs,
        netExposureMinor: position.signedExposureMinor,
        marketValueMinor: position.marketValueMinor,
      }));
    }

    const clusters = profile?.correlationClusterIds ?? [];
    for (const clusterId of clusters) {
      clusterExposure.set(clusterId, (clusterExposure.get(clusterId) ?? 0n) + abs);
      const members = clusterMembers.get(clusterId) ?? new Set<string>();
      members.add(position.instrumentId);
      clusterMembers.set(clusterId, members);
    }
  }

  const denominator = input.totalEquityMinor > 0n ? input.totalEquityMinor : 1n;
  const clusterExposures: ClusterExposureFact[] = [];
  for (const [clusterId, exposureMinor] of clusterExposure.entries()) {
    clusterExposures.push(
      Object.freeze({
        clusterId,
        exposureMinor,
        exposureRatio: shareOf(exposureMinor, denominator),
        memberInstrumentIds: Object.freeze([...(clusterMembers.get(clusterId) ?? new Set<string>())]),
      }),
    );
  }

  const assetClassExposures: Partial<Record<AssetClassTag, bigint>> = {};
  for (const [tag, value] of classMap.entries()) {
    assetClassExposures[tag] = value;
  }

  const venueExposures: VenueExposureFact[] = [];
  for (const [venue, exposureMinor] of venueMap.entries()) {
    venueExposures.push(Object.freeze({ venue, exposureMinor }));
  }

  return Object.freeze({
    grossExposureMinor: gross,
    netExposureMinor: net,
    strategyExposures: Object.freeze([...strategyMap.values()]),
    venueExposures: Object.freeze(venueExposures),
    clusterExposures: Object.freeze(clusterExposures),
    assetClassExposures: Object.freeze(assetClassExposures as Readonly<Record<AssetClassTag, bigint>>),
    portfolioDrawdown: null,
    liquidityMinor: 0n,
  });
}

export function clusterExposureRatio(cluster: ClusterExposureFact, totalEquityMinor: bigint): Ratio {
  return shareOf(cluster.exposureMinor, totalEquityMinor > 0n ? totalEquityMinor : 1n);
}

export function detectElevatedRiskOnClusters(clusters: readonly ClusterExposureFact[], threshold: Ratio): readonly string[] {
  const elevated: string[] = [];
  for (const cluster of clusters) {
    if (cluster.exposureRatio.units >= threshold.units && cluster.clusterId.includes('RISK_ON')) {
      elevated.push(cluster.clusterId);
    }
  }
  return Object.freeze(elevated);
}
