import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeSourceIndependence,
  effectiveIndependentCount,
} from './independence.ts';
import { evaluateCorroboration } from './corroboration.ts';
import { assessNumericConflicts } from './conflicts.ts';
import { assessFreshness } from './freshness.ts';
import { createInformationConsensusEngine } from './engine.ts';
import { informationConsensusCreatesMoney } from './verified-fact.ts';
import { AI_INFORMATION_CONSENSUS_ROLE } from './ai-boundary.ts';
import {
  buildConsensusInput,
  CONFLICTING_OBSERVATIONS,
  HUMAN_ATTESTATION_OBSERVATION,
  HUMAN_CONTRIBUTION_CANDIDATE,
  PRODUCTIVE_ENERGY_CANDIDATE,
  REPUTATION_RECORDS,
  RIGHTS_RESTRICTED_OBSERVATION,
  STALE_OBSERVATION,
  THREE_INDEPENDENT_SOURCES,
  THREE_PROVIDERS_ONE_UPSTREAM,
  UNVERIFIED_PROVIDER_OBSERVATION,
} from './fixtures.ts';
import {
  HUMAN_CONTRIBUTION_METHODOLOGY,
  PRODUCTIVE_ENERGY_METHODOLOGY,
  resolveMethodologyPolicy,
} from './methodology.ts';

describe('Information Consensus — source independence', () => {
  it('counts three providers sharing one upstream as one independent lineage', () => {
    const analysis = analyzeSourceIndependence(THREE_PROVIDERS_ONE_UPSTREAM);
    assert.equal(analysis.rawProviderCount, 3);
    assert.equal(analysis.independentLineageRootCount, 1);
    assert.equal(effectiveIndependentCount(THREE_PROVIDERS_ONE_UPSTREAM), 1);
    assert.equal(analysis.endpointCountIsNotIndependence, true);
  });

  it('counts three genuinely independent sources separately', () => {
    const analysis = analyzeSourceIndependence(THREE_INDEPENDENT_SOURCES);
    assert.equal(analysis.rawProviderCount, 3);
    assert.equal(analysis.independentLineageRootCount, 3);
    assert.equal(analysis.independentSourceClassCount, 3);
  });
});

describe('Information Consensus — corroboration', () => {
  it('does not satisfy productive energy quorum with shared upstream only', () => {
    const policy = resolveMethodologyPolicy(PRODUCTIVE_ENERGY_METHODOLOGY.methodology);
    const independence = analyzeSourceIndependence(THREE_PROVIDERS_ONE_UPSTREAM);
    const corroboration = evaluateCorroboration(policy, THREE_PROVIDERS_ONE_UPSTREAM, independence);
    assert.equal(corroboration.satisfied, false);
    assert.equal(corroboration.independentSourceClassCount, 1);
  });

  it('satisfies productive energy corroboration with independent classes', () => {
    const policy = resolveMethodologyPolicy(PRODUCTIVE_ENERGY_METHODOLOGY.methodology);
    const independence = analyzeSourceIndependence(THREE_INDEPENDENT_SOURCES);
    const corroboration = evaluateCorroboration(policy, THREE_INDEPENDENT_SOURCES, independence);
    assert.equal(corroboration.satisfied, true);
    assert.ok(corroboration.matchedRules.length > 0);
  });
});

describe('Information Consensus — conflicts', () => {
  it('detects material conflict and outlier among 500/495/900 MWh', () => {
    const policy = resolveMethodologyPolicy(PRODUCTIVE_ENERGY_METHODOLOGY.methodology);
    const assessment = assessNumericConflicts(CONFLICTING_OBSERVATIONS, policy.conflictTolerance);
    assert.equal(assessment.withinTolerance, false);
    assert.equal(assessment.hasMaterialConflict, true);
    assert.equal(assessment.hasOutlier, true);
    const outlierPair = assessment.conflicts.find((row) => row.leftValue === 900 || row.rightValue === 900);
    assert.ok(outlierPair);
    assert.equal(outlierPair?.outlier, true);
  });

  it('treats 500 vs 495 as within tolerance', () => {
    const policy = resolveMethodologyPolicy(PRODUCTIVE_ENERGY_METHODOLOGY.methodology);
    const pair = THREE_INDEPENDENT_SOURCES.filter((row) => row.numericValue === 500 || row.numericValue === 495);
    const assessment = assessNumericConflicts(pair, policy.conflictTolerance);
    assert.equal(assessment.hasMaterialConflict, false);
    assert.equal(assessment.withinTolerance, true);
  });
});

describe('Information Consensus — freshness', () => {
  it('marks stale grid observation under short freshness window', () => {
    const policy = resolveMethodologyPolicy(PRODUCTIVE_ENERGY_METHODOLOGY.methodology);
    const assessment = assessFreshness([STALE_OBSERVATION], policy.freshnessPolicy, '2026-09-02T09:30:00.000Z');
    assert.equal(assessment.status, 'stale');
    assert.ok(assessment.staleObservationIds.includes('obs-stale'));
  });
});

describe('Information Consensus — engine adversarial fixtures', () => {
  const engine = createInformationConsensusEngine({ reputationRecords: REPUTATION_RECORDS });

  it('returns INSUFFICIENT_EVIDENCE for three providers with one upstream', () => {
    const evaluation = engine.evaluate(
      buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, THREE_PROVIDERS_ONE_UPSTREAM),
    );
    assert.equal(evaluation.receipt.result, 'INSUFFICIENT_EVIDENCE');
    assert.equal(evaluation.verifiedFact, null);
    assert.ok(evaluation.receipt.explanationCodes.includes('SHARED_UPSTREAM_LINEAGE'));
    assert.equal(evaluation.receipt.grantsMonetaryAuthority, false);
  });

  it('returns VERIFIED for three independent productive sources', () => {
    const evaluation = engine.evaluate(
      buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, THREE_INDEPENDENT_SOURCES),
    );
    assert.equal(evaluation.receipt.result, 'VERIFIED');
    assert.ok(evaluation.verifiedFact);
    assert.equal(evaluation.verifiedFact?.grantsMonetaryAuthority, false);
    assert.equal(evaluation.verifiedFact?.verifiedNumericValue, 498);
    assert.equal(informationConsensusCreatesMoney(), false);
  });

  it('returns STALE when supporting observation is stale', () => {
    const evaluation = engine.evaluate(
      buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, [STALE_OBSERVATION]),
    );
    assert.equal(evaluation.receipt.result, 'STALE');
    assert.equal(evaluation.verifiedFact, null);
    assert.ok(evaluation.receipt.explanationCodes.includes('FRESHNESS_STALE'));
  });

  it('returns MANUAL_REVIEW_REQUIRED or DISPUTED for conflicting sources', () => {
    const evaluation = engine.evaluate(
      buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, CONFLICTING_OBSERVATIONS),
    );
    assert.ok(['MANUAL_REVIEW_REQUIRED', 'DISPUTED'].includes(evaluation.receipt.result));
    assert.equal(evaluation.verifiedFact, null);
    assert.ok(evaluation.receipt.explanationCodes.includes('MATERIAL_CONFLICT_DETECTED'));
  });

  it('returns INVALID for unverified provider when policy forbids it', () => {
    const evaluation = engine.evaluate(
      buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, [UNVERIFIED_PROVIDER_OBSERVATION]),
    );
    assert.equal(evaluation.receipt.result, 'INVALID');
    assert.ok(evaluation.receipt.explanationCodes.includes('PROVIDER_UNVERIFIED'));
  });

  it('returns RIGHTS_RESTRICTED for rights-restricted source', () => {
    const evaluation = engine.evaluate(
      buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, [RIGHTS_RESTRICTED_OBSERVATION], {
        rightsStatus: 'RESTRICTED',
      }),
    );
    assert.equal(evaluation.receipt.result, 'RIGHTS_RESTRICTED');
    assert.ok(evaluation.receipt.explanationCodes.includes('RIGHTS_RESTRICTED'));
  });

  it('verifies human contribution with attestation evidence', () => {
    const evaluation = engine.evaluate(
      buildConsensusInput(HUMAN_CONTRIBUTION_CANDIDATE, [HUMAN_ATTESTATION_OBSERVATION], {
        methodology: HUMAN_CONTRIBUTION_METHODOLOGY.methodology,
      }),
    );
    assert.equal(evaluation.receipt.result, 'VERIFIED');
    assert.equal(evaluation.verifiedFact?.domain, 'HUMAN');
    assert.equal(evaluation.verifiedFact?.verifiedCategoricalValue, 'peer-reviewed-publication');
    assert.ok(evaluation.receipt.explanationCodes.includes('HUMAN_ATTESTATION_PRESENT'));
  });

  it('seals auditable receipt with required fields', () => {
    const evaluation = engine.evaluate(
      buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, THREE_INDEPENDENT_SOURCES),
    );
    const receipt = evaluation.receipt;
    assert.ok(receipt.evaluationId.length > 0);
    assert.equal(receipt.schemaVersion, 'sunrey.information-consensus.v1');
    assert.equal(receipt.observationIdsEvaluated.length, 3);
    assert.equal(receipt.independentSourceClasses.length, 3);
    assert.equal(receipt.grantsExecutionAuthority, false);
    assert.ok(receipt.explanationCodes.includes('ZERO_MONETARY_AUTHORITY'));
  });
});

describe('Information Consensus — AI boundary', () => {
  it('never grants monetary or execution authority via AI assistance', () => {
    assert.equal(AI_INFORMATION_CONSENSUS_ROLE.mayDeclareMonetaryTruth, false);
    assert.equal(AI_INFORMATION_CONSENSUS_ROLE.mayApproveIssuance, false);
    assert.equal(AI_INFORMATION_CONSENSUS_ROLE.mayOverrideFailedRights, false);
    assert.equal(AI_INFORMATION_CONSENSUS_ROLE.mayFabricateObservations, false);
  });
});
