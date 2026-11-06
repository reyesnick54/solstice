import {
  DEFAULT_VAL08_SEED,
  HELIOS_VAL08_PROBABILISTIC_COMPARABLES_QUALIFIED,
  VAL08_PROBABILISTIC_COMPARABLES_SCHEMA,
} from './taxonomy.ts';
import { applyCrossBorderFilters, type CrossBorderPolicy } from './cross-border.ts';
import {
  computePeerConsensusStrength,
  computePeerPanelFragility,
  computePeerValuationDispersion,
} from './disagreement.ts';
import { adjustObservationMultiple, buildJustifiedMultipleState } from './justified-multiple.ts';
import { computePeerMultiple, impliedValuesFromMultiple } from './multiples.ts';
import { analyzeOutlier, defaultOutlierPolicy, isExtremeOutlier } from './outliers.ts';
import { filterPeersKnowableAtValuationTime } from './point-in-time.ts';
import { defaultPeerSelectionConfig, runPeerSelection } from './peer-selection.ts';
import { assessPeerQuality } from './quality.ts';
import type {
  ComparableMultipleObservation,
  ComparableValuationDistribution,
  PeerExclusionRecord,
  PeerPanelManifest,
  ProbabilisticComparablesInput,
  ProbabilisticComparablesResult,
} from './types.ts';
import { applySeededCopulaSpread, buildComparableValuationDistribution } from './valuation-distribution.ts';

export function runProbabilisticComparablesEngine(
  input: ProbabilisticComparablesInput,
): ProbabilisticComparablesResult {
  const seed = input.seed ?? DEFAULT_VAL08_SEED;
  const maxPeers = input.maxPeers ?? 12;
  const multipleKinds = input.multipleKinds ?? ['EV_EBITDA', 'PS', 'PE'];
  const outlierPolicy = defaultOutlierPolicy();

  const pit = filterPeersKnowableAtValuationTime(
    input.valuationTimeUtc,
    input.universe,
    input.target.peerId,
  );

  const crossBorderPolicy: CrossBorderPolicy = Object.freeze({
    requireSameAccounting: input.userPeerConstraints?.requireSameAccounting ?? false,
    requireSameCurrency: input.userPeerConstraints?.requireSameCurrency ?? false,
    maxCountryRiskGapBps: input.userPeerConstraints?.maxCountryRiskGapBps ?? 500,
  });

  const crossBorder = applyCrossBorderFilters(input.target, pit.eligible, crossBorderPolicy);
  const allExcluded: PeerExclusionRecord[] = [...pit.excluded, ...crossBorder.excluded];

  const selection = runPeerSelection(
    input.valuationTimeUtc,
    input.target,
    crossBorder.eligible,
    defaultPeerSelectionConfig(maxPeers, seed),
  );

  const selectionWithExclusions: typeof selection = Object.freeze({
    ...selection,
    excludedPeers: Object.freeze(allExcluded),
  });

  const selectedPeers = crossBorder.eligible.filter((p) => selection.selectedPeerIds.includes(p.peerId));

  const observations: ComparableMultipleObservation[] = [];
  const justifiedMultiples = multipleKinds.map((kind) => {
    const peerRaw: number[] = [];
    for (const peer of selectedPeers) {
      const comp = computePeerMultiple(peer, kind);
      if (comp.multiple !== null) peerRaw.push(comp.multiple);
    }
    return buildJustifiedMultipleState(kind, input.target, peerRaw);
  });

  for (const kind of multipleKinds) {
    const justified = justifiedMultiples.find((j) => j.multipleKind === kind)!;
    const rawMultiplesForKind: number[] = [];

    for (const peer of selectedPeers) {
      const comp = computePeerMultiple(peer, kind);
      if (comp.multiple === null) {
        allExcluded.push(
          Object.freeze({
            peerId: peer.peerId,
            reason: comp.exclusionReason ?? 'MISSING_REQUIRED_FUNDAMENTALS',
            detail: `${kind} undefined for peer`,
          }),
        );
        continue;
      }
      rawMultiplesForKind.push(comp.multiple);
    }

    for (const peer of selectedPeers) {
      const comp = computePeerMultiple(peer, kind);
      if (comp.multiple === null) continue;

      const outlierEvidence = analyzeOutlier(comp.multiple, rawMultiplesForKind, outlierPolicy);
      const adjustedMultiple = adjustObservationMultiple(outlierEvidence.winsorizedMultiple, justified);
      const implied = impliedValuesFromMultiple(input.target, kind, adjustedMultiple);

      const similarityWeight = selectionWithExclusions.blendedWeights[peer.peerId] ?? 0;
      const quality = assessPeerQuality(
        input.valuationTimeUtc,
        input.target,
        peer,
        selectionWithExclusions,
        input.regimeLabel,
      );
      const dataQualityWeight = quality.overallQuality;
      const recencyWeight = 1 / (1 + quality.recencyDays / 90);
      const regimeRelevanceWeight = quality.regimeRelevance;
      const compositeWeight =
        similarityWeight * dataQualityWeight * recencyWeight * regimeRelevanceWeight || 0.001;

      const crossBorderAdj =
        input.target.countryRiskPremiumBps !== undefined && peer.countryRiskPremiumBps !== undefined
          ? Math.abs(input.target.countryRiskPremiumBps - peer.countryRiskPremiumBps)
          : 0;

      observations.push(
        Object.freeze({
          observationId: `${input.valuationId}:${peer.peerId}:${kind}`,
          peerId: peer.peerId,
          multipleKind: kind,
          rawMultiple: comp.multiple,
          justifiedMultiple: adjustedMultiple,
          impliedEquityValue: implied.equityValue,
          impliedEnterpriseValue: implied.enterpriseValue,
          observationTimeUtc: input.valuationTimeUtc,
          knowableAt: peer.knowableAt,
          similarityWeight,
          dataQualityWeight,
          recencyWeight,
          regimeRelevanceWeight,
          compositeWeight,
          outlier: outlierEvidence,
          crossBorderAdjustmentBps: crossBorderAdj,
          excludedFromPrimaryDistribution: isExtremeOutlier(outlierEvidence, outlierPolicy),
        }),
      );
    }
  }

  const primaryObs = observations.filter((o) => !o.excludedFromPrimaryDistribution);
  let equityValues = primaryObs.map((o) => o.impliedEquityValue);
  let weights = primaryObs.map((o) => o.compositeWeight);

  if (input.enableCopula && equityValues.length >= 4) {
    equityValues = [...applySeededCopulaSpread(equityValues, seed, 0.35)];
  }

  const equityValueDistribution = buildComparableValuationDistribution(equityValues, weights);

  const evObs = primaryObs.filter((o) => o.impliedEnterpriseValue !== null);
  const enterpriseValueDistribution =
    evObs.length > 0
      ? buildComparableValuationDistribution(
          evObs.map((o) => o.impliedEnterpriseValue!),
          evObs.map((o) => o.compositeWeight),
        )
      : null;

  const dispersion = computePeerValuationDispersion(primaryObs.length ? primaryObs : observations);
  const consensus = computePeerConsensusStrength(primaryObs.length ? primaryObs : observations, selectionWithExclusions);
  let fragility = computePeerPanelFragility(primaryObs.length ? primaryObs : observations, selectionWithExclusions, dispersion);

  let finalEquityDistribution: ComparableValuationDistribution = equityValueDistribution;
  if (consensus.score < 0.45) {
    const widen = 1 + (0.45 - consensus.score);
    finalEquityDistribution = buildComparableValuationDistribution(
      equityValues.map((v) => v * widen),
      weights,
    );
    fragility = Object.freeze({
      ...fragility,
      score: Math.min(1, fragility.score + (0.45 - consensus.score) * 0.5),
      drivers: Object.freeze([...fragility.drivers, 'peer_disagreement_widens_uncertainty']),
    });
  }

  const qualityByPeer = selectedPeers.map((peer) =>
    assessPeerQuality(input.valuationTimeUtc, input.target, peer, selectionWithExclusions, input.regimeLabel),
  );

  const panelManifest: PeerPanelManifest = Object.freeze({
    manifestId: `${input.valuationId}:peer-panel`,
    valuationTimeUtc: input.valuationTimeUtc,
    targetEntityLabel: input.entityLabel,
    targetPeerId: input.target.peerId,
    universeSize: input.universe.length,
    eligibleCount: crossBorder.eligible.length,
    selectedCount: selectedPeers.length,
    excludedCount: allExcluded.length,
    selectionState: selectionWithExclusions,
    qualityByPeer: Object.freeze(qualityByPeer),
    multipleKindsUsed: Object.freeze([...multipleKinds]),
    crossBorderAdjustmentsApplied: crossBorderPolicy.requireSameAccounting || crossBorderPolicy.requireSameCurrency,
    outlierPolicy: `mad_z_${outlierPolicy.madZThreshold}_winsor_${outlierPolicy.winsorizeFraction}`,
  });

  return Object.freeze({
    schema: VAL08_PROBABILISTIC_COMPARABLES_SCHEMA,
    valuationId: input.valuationId,
    entityLabel: input.entityLabel,
    grantsExecutionAuthority: false,
    researchOnly: true,
    seed,
    panelManifest,
    observations: Object.freeze(observations),
    justifiedMultiples: Object.freeze(justifiedMultiples),
    equityValueDistribution: finalEquityDistribution,
    enterpriseValueDistribution,
    dispersion,
    consensus,
    fragility,
    qualificationMarker: HELIOS_VAL08_PROBABILISTIC_COMPARABLES_QUALIFIED,
  });
}
