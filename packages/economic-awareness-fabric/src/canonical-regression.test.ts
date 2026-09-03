/**
 * Canonical EAF regression tests — source independence and monetary authority separation.
 *
 * Tests A–G from Solstice architecture stabilization prompt 3.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { NormalizedEconomicObservation } from '@solstice/sunrey-chain/economic-awareness-fabric';
import {
  analyzeSourceIndependence,
  buildConsensusInput,
  evaluateInformationConsensus,
  informationConsensusCreatesMoney,
  resolveMethodologyPolicy,
  evaluateCorroboration,
  PRODUCTIVE_ENERGY_CANDIDATE,
  PRODUCTIVE_ENERGY_METHODOLOGY,
  THREE_INDEPENDENT_SOURCES,
  THREE_PROVIDERS_ONE_UPSTREAM,
  INFORMATION_CONSENSUS_CREATES_MONEY,
  INFORMATION_CONSENSUS_GRANTS_EXECUTION_AUTHORITY,
} from './consensus/index.ts';
import { capabilityBlocksMonetaryMutation, authority } from './index.ts';

const SHARED_ROOT = 'lineage-root:shared-upstream';
const SHARED_ORG = 'org:shared-upstream';

function sharedUpstreamObservation(
  observationId: string,
  providerId: string,
  numericValue: number,
): NormalizedEconomicObservation {
  const observedAt = '2026-09-02T09:00:00.000Z';
  return Object.freeze({
    observationId,
    providerId,
    sourceId: `source:${providerId}`,
    sourceClass: 'AGGREGATOR',
    canonicalSourceCategory: 'energy',
    factType: 'ENERGY_PRODUCTION',
    subjectRef: 'facility:grid-west-1',
    numericValue,
    categoricalValue: null,
    unit: 'MWh',
    authorityClass: 'regulated_provider',
    observedAt,
    collectedAt: observedAt,
    provenanceRef: `prov:${observationId}`,
    integrityStatus: 'VERIFIED',
    rightsStatus: 'CLEAR',
    providerVerified: true,
    lineage: Object.freeze({
      providerId,
      sourceId: `source:${providerId}`,
      upstreamSourceId: SHARED_ROOT,
      upstreamOrganizationId: SHARED_ORG,
      controllerId: `controller:${providerId}`,
      sharedControlGroup: null,
      lineageRootId: SHARED_ROOT,
      sourceClass: 'AGGREGATOR',
      canonicalSourceCategory: 'energy',
    }),
  });
}

function independentObservation(
  observationId: string,
  providerId: string,
  lineageRootId: string,
  upstreamOrganizationId: string,
  sourceClass: NormalizedEconomicObservation['sourceClass'],
  numericValue: number,
): NormalizedEconomicObservation {
  const observedAt = '2026-09-02T09:00:00.000Z';
  return Object.freeze({
    observationId,
    providerId,
    sourceId: `source:${providerId}`,
    sourceClass,
    canonicalSourceCategory: 'energy',
    factType: 'ENERGY_PRODUCTION',
    subjectRef: 'facility:grid-west-1',
    numericValue,
    categoricalValue: null,
    unit: 'MWh',
    authorityClass: sourceClass === 'GOVERNMENT_REFERENCE' ? 'authoritative_official' : 'regulated_provider',
    observedAt,
    collectedAt: observedAt,
    provenanceRef: `prov:${observationId}`,
    integrityStatus: 'VERIFIED',
    rightsStatus: 'CLEAR',
    providerVerified: true,
    lineage: Object.freeze({
      providerId,
      sourceId: `source:${providerId}`,
      upstreamSourceId: lineageRootId,
      upstreamOrganizationId,
      controllerId: `controller:${providerId}`,
      sharedControlGroup: null,
      lineageRootId,
      sourceClass,
      canonicalSourceCategory: 'energy',
    }),
  });
}

const FIVE_ONE_UPSTREAM: readonly NormalizedEconomicObservation[] = Object.freeze([
  sharedUpstreamObservation('obs-1', 'provider-1', 500),
  sharedUpstreamObservation('obs-2', 'provider-2', 501),
  sharedUpstreamObservation('obs-3', 'provider-3', 499),
  sharedUpstreamObservation('obs-4', 'provider-4', 502),
  sharedUpstreamObservation('obs-5', 'provider-5', 498),
]);

const FIVE_INDEPENDENT: readonly NormalizedEconomicObservation[] = Object.freeze([
  independentObservation('obs-a', 'sensor-a', 'lineage-root:a', 'org:a', 'DIRECT_SENSOR', 500),
  independentObservation('obs-b', 'sensor-b', 'lineage-root:b', 'org:b', 'PRIMARY_OPERATOR', 495),
  independentObservation('obs-c', 'sensor-c', 'lineage-root:c', 'org:c', 'GOVERNMENT_REFERENCE', 498),
  independentObservation('obs-d', 'sensor-d', 'lineage-root:d', 'org:d', 'SATELLITE_REMOTE', 497),
  independentObservation('obs-e', 'sensor-e', 'lineage-root:e', 'org:e', 'ENTERPRISE_SYSTEM', 496),
]);

describe('Canonical EAF regression — source independence (A–E)', () => {
  it('TEST A: five observations from one upstream do not count as five independent sources', () => {
    const analysis = analyzeSourceIndependence(FIVE_ONE_UPSTREAM);
    assert.equal(analysis.rawObservationCount, 5);
    assert.equal(analysis.rawProviderCount, 5);
    assert.equal(analysis.independentLineageRootCount, 1);

    const policy = resolveMethodologyPolicy(PRODUCTIVE_ENERGY_METHODOLOGY.methodology);
    const corroboration = evaluateCorroboration(policy, FIVE_ONE_UPSTREAM, analysis);
    assert.equal(corroboration.satisfied, false);

    const evaluation = evaluateInformationConsensus(
      buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, FIVE_ONE_UPSTREAM),
    );
    assert.notEqual(evaluation.receipt.result, 'VERIFIED');
    assert.equal(evaluation.verifiedFact, null);
  });

  it('TEST B: five genuinely independent sources contribute five independent corroborations', () => {
    const analysis = analyzeSourceIndependence(FIVE_INDEPENDENT);
    assert.equal(analysis.independentLineageRootCount, 5);
    assert.equal(analysis.independentSourceClassCount, 5);

    const policy = resolveMethodologyPolicy(PRODUCTIVE_ENERGY_METHODOLOGY.methodology);
    const corroboration = evaluateCorroboration(policy, FIVE_INDEPENDENT, analysis);
    assert.equal(corroboration.satisfied, true);
    assert.ok(corroboration.independentSourceClassCount >= 3);
  });

  it('TEST C: duplicate observations do not increase confidence as if independently sourced', () => {
    const base = THREE_INDEPENDENT_SOURCES[0]!;
    const withDuplicates = Object.freeze([...THREE_INDEPENDENT_SOURCES, base, base, base]);
    const uniqueAnalysis = analyzeSourceIndependence(THREE_INDEPENDENT_SOURCES);
    const duplicateAnalysis = analyzeSourceIndependence(withDuplicates);

    assert.equal(uniqueAnalysis.independentLineageRootCount, duplicateAnalysis.independentLineageRootCount);
    assert.equal(uniqueAnalysis.independentSourceClassCount, duplicateAnalysis.independentSourceClassCount);

    const policy = resolveMethodologyPolicy(PRODUCTIVE_ENERGY_METHODOLOGY.methodology);
    const uniqueCorroboration = evaluateCorroboration(policy, THREE_INDEPENDENT_SOURCES, uniqueAnalysis);
    const duplicateCorroboration = evaluateCorroboration(policy, withDuplicates, duplicateAnalysis);
    assert.equal(uniqueCorroboration.satisfied, duplicateCorroboration.satisfied);
    assert.equal(
      uniqueCorroboration.independentSourceClassCount,
      duplicateCorroboration.independentSourceClassCount,
    );
  });

  it('TEST D: reordered observations produce deterministic consensus', () => {
    const ordered = THREE_INDEPENDENT_SOURCES;
    const reversed = Object.freeze([...THREE_INDEPENDENT_SOURCES].reverse());
    const shuffled = Object.freeze([
      THREE_INDEPENDENT_SOURCES[1]!,
      THREE_INDEPENDENT_SOURCES[2]!,
      THREE_INDEPENDENT_SOURCES[0]!,
    ]);

    const inputOrdered = buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, ordered);
    const inputReversed = buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, reversed);
    const inputShuffled = buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, shuffled);

    const evalOrdered = evaluateInformationConsensus(inputOrdered);
    const evalReversed = evaluateInformationConsensus(inputReversed);
    const evalShuffled = evaluateInformationConsensus(inputShuffled);

    assert.equal(evalOrdered.receipt.evaluationId, evalReversed.receipt.evaluationId);
    assert.equal(evalOrdered.receipt.evaluationId, evalShuffled.receipt.evaluationId);
    assert.equal(evalOrdered.receipt.result, evalReversed.receipt.result);
    assert.equal(evalOrdered.receipt.result, evalShuffled.receipt.result);
  });

  it('TEST E: repeated observation ingestion does not artificially increase confidence', () => {
    const firstPass = evaluateInformationConsensus(
      buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, THREE_PROVIDERS_ONE_UPSTREAM),
    );
    const secondPass = evaluateInformationConsensus(
      buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, THREE_PROVIDERS_ONE_UPSTREAM),
    );
    const doubled = evaluateInformationConsensus(
      buildConsensusInput(
        PRODUCTIVE_ENERGY_CANDIDATE,
        Object.freeze([...THREE_PROVIDERS_ONE_UPSTREAM, ...THREE_PROVIDERS_ONE_UPSTREAM]),
      ),
    );

    assert.equal(firstPass.receipt.result, secondPass.receipt.result);
    assert.equal(firstPass.receipt.independentSourceClasses.length, secondPass.receipt.independentSourceClasses.length);
    assert.equal(doubled.receipt.independentSourceClasses.length, firstPass.receipt.independentSourceClasses.length);
    assert.notEqual(doubled.receipt.result, 'VERIFIED');
  });
});

describe('Canonical EAF regression — monetary authority separation (F)', () => {
  it('TEST F: EAF cannot directly authorize monetary issuance', () => {
    assert.equal(capabilityBlocksMonetaryMutation(), true);
    assert.equal(informationConsensusCreatesMoney(), false);
    assert.equal(INFORMATION_CONSENSUS_CREATES_MONEY, false);
    assert.equal(INFORMATION_CONSENSUS_GRANTS_EXECUTION_AUTHORITY, false);

    const evaluation = evaluateInformationConsensus(
      buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, THREE_INDEPENDENT_SOURCES),
    );
    assert.equal(evaluation.receipt.grantsMonetaryAuthority, false);
    assert.equal(evaluation.receipt.grantsExecutionAuthority, false);
    assert.ok(evaluation.verifiedFact);
    assert.equal(evaluation.verifiedFact?.grantsMonetaryAuthority, false);
    assert.equal(evaluation.verifiedFact?.grantsExecutionAuthority, false);

    const rejectSunRey = authority.rejectMonetaryAuthority('issue_sunrey');
    const rejectMoonRey = authority.rejectMonetaryAuthority('issue_moonrey');
    assert.equal(rejectSunRey.permitted, false);
    assert.equal(rejectMoonRey.permitted, false);
  });
});

describe('Canonical EAF regression — backwards compatibility (G)', () => {
  it('TEST G: existing legitimate consensus behavior remains backwards-compatible', () => {
    const sharedUpstream = evaluateInformationConsensus(
      buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, THREE_PROVIDERS_ONE_UPSTREAM),
    );
    assert.equal(sharedUpstream.receipt.result, 'INSUFFICIENT_EVIDENCE');
    assert.equal(sharedUpstream.verifiedFact, null);
    assert.ok(sharedUpstream.receipt.explanationCodes.includes('SHARED_UPSTREAM_LINEAGE'));

    const independent = evaluateInformationConsensus(
      buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, THREE_INDEPENDENT_SOURCES),
    );
    assert.equal(independent.receipt.result, 'VERIFIED');
    assert.ok(independent.verifiedFact);
    assert.equal(independent.verifiedFact?.verifiedNumericValue, 498);
  });
});
