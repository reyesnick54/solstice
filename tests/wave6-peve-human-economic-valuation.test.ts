/**
 * Wave 6 — PEVE and Human Economic Valuation tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AUTHORIZED_DATA_USE_METHODOLOGY_V1,
  COMPUTATION_METHODOLOGY_V1,
  EDUCATION_METHODOLOGY_V1,
  HUMAN_WORTH_ASSIGNED,
  HUMAN_WORTH_SCORE,
  HumanEconomicValueEngine,
  MARKET_SEPARATION,
  PEVE_AI_ROLE,
  PEVE_SCORE_USED_AS_VALUE,
  RESEARCH_METHODOLOGY_V1,
  WAVE6_PEVE_BOUNDARY,
  WORK_METHODOLOGY_V1,
  aiPeveAssist,
  buildVerifiedHumanEconomicContributionInput,
  peveInvariantUnderMarketPriceChange,
  peveResultExcludesMarketPrice,
  refuseAiCanonicalPeveInput,
  refuseProductionPeve,
  rejectGpuvAsPeveSubstitute,
  rejectMarketPriceAsPeveInput,
  resolveMethodology,
} from '../packages/human-economic-contribution/src/peve/index.ts';
import {
  COMMUNITY_CONTRIBUTION_POLICY,
  createSimulationValuationPolicy,
  engineWith,
  referenceFor,
  VALUATION_NOW,
  verifyFixture,
} from '../packages/human-economic-contribution/src/valuation/index.ts';
import { asValuationPolicyVersion } from '../packages/human-economic-contribution/src/valuation/ids.ts';
import { InMemoryValuationReferenceDataPort } from '../packages/human-economic-contribution/src/valuation/reference-data.ts';

function researchInput(seed: string) {
  const record = verifyFixture('RESEARCH_PARTICIPATION', seed, 3n);
  return buildVerifiedHumanEconomicContributionInput({
    registryRecord: record,
    humanEconomicClaimId: `claim.${seed}`,
    canonicalEventId: record.event.eventReference,
    verificationReceiptRef: `vreceipt.${seed}`,
    identityAssuranceLevel: 'STANDARD',
    evidenceProofRefs: [`evidence.proof.${seed}`],
    rightsProofRefs: [],
    consentProofRefs: [`consent.proof.${seed}`],
    policyProofRefs: [`policy.proof.${seed}`],
    authorizedScope: 'research-participation.simulation',
    uniquenessStatus: 'UNIQUE',
    methodologyId: RESEARCH_METHODOLOGY_V1.methodologyId,
    methodologyVersion: RESEARCH_METHODOLOGY_V1.methodologyVersion,
  });
}

function workInput(seed: string) {
  const record = verifyFixture('PROFESSIONAL_EXPERTISE', seed, 2n);
  return buildVerifiedHumanEconomicContributionInput({
    registryRecord: record,
    humanEconomicClaimId: `claim.${seed}`,
    canonicalEventId: record.event.eventReference,
    verificationReceiptRef: `vreceipt.${seed}`,
    identityAssuranceLevel: 'ENHANCED',
    evidenceProofRefs: [`evidence.proof.${seed}`],
    rightsProofRefs: [],
    consentProofRefs: [],
    policyProofRefs: [`policy.proof.${seed}`],
    authorizedScope: 'professional-service.simulation',
    uniquenessStatus: 'UNIQUE',
    methodologyId: WORK_METHODOLOGY_V1.methodologyId,
    methodologyVersion: WORK_METHODOLOGY_V1.methodologyVersion,
  });
}

describe('Wave 6 — PEVE and Human Economic Valuation', () => {
  it('encodes PEVE boundary invariants', () => {
    assert.equal(WAVE6_PEVE_BOUNDARY.humanWorthAssigned, false);
    assert.equal(WAVE6_PEVE_BOUNDARY.humanWorthScore, false);
    assert.equal(WAVE6_PEVE_BOUNDARY.peveScoreUsedAsValue, false);
    assert.equal(WAVE6_PEVE_BOUNDARY.mintsSunRey, false);
    assert.equal(WAVE6_PEVE_BOUNDARY.setsExchangePrice, false);
    assert.equal(HUMAN_WORTH_ASSIGNED, false);
    assert.equal(HUMAN_WORTH_SCORE, false);
    assert.equal(PEVE_SCORE_USED_AS_VALUE, false);
    assert.equal(MARKET_SEPARATION.exchangePriceDeterminesPeve, false);
    assert.equal(MARKET_SEPARATION.peveDeterminesExchangePrice, false);
    assert.equal(MARKET_SEPARATION.gpuvSubstitutesPeve, false);
  });

  it('same verified contribution and methodology yields the same deterministic result', () => {
    const seed = 'wave6-determinism';
    const input = researchInput(seed);
    const policy = createSimulationValuationPolicy();
    const references = [referenceFor('RESEARCH_PARTICIPATION_SCHEDULE', seed, 5_000n)];
    const engineA = new HumanEconomicValueEngine(new InMemoryValuationReferenceDataPort(references));
    const engineB = new HumanEconomicValueEngine(new InMemoryValuationReferenceDataPort(references));
    const first = engineA.evaluate({
      valuationInput: input,
      policy,
      valuationTimestamp: VALUATION_NOW,
      policyReference: 'policy.sim.research-valuation.unconfigured',
    });
    const second = engineB.evaluate({
      valuationInput: input,
      policy,
      valuationTimestamp: VALUATION_NOW,
      policyReference: 'policy.sim.research-valuation.unconfigured',
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) {
      return;
    }
    assert.equal(first.result.valuationDigest, second.result.valuationDigest);
    assert.equal(first.result.finalReferenceValue, second.result.finalReferenceValue);
    assert.equal(first.receipt.resultCommitment, second.receipt.resultCommitment);
  });

  it('different methodology version explicitly differs', () => {
    const seed = 'wave6-method-version';
    const record = verifyFixture('RESEARCH_PARTICIPATION', seed, 3n);
    const inputV1 = buildVerifiedHumanEconomicContributionInput({
      registryRecord: record,
      humanEconomicClaimId: `claim.${seed}`,
      canonicalEventId: record.event.eventReference,
      verificationReceiptRef: `vreceipt.${seed}`,
      identityAssuranceLevel: 'STANDARD',
      evidenceProofRefs: [`evidence.proof.${seed}`],
      rightsProofRefs: [],
      consentProofRefs: [`consent.proof.${seed}`],
      policyProofRefs: [`policy.proof.${seed}`],
      authorizedScope: 'research-participation.simulation',
      uniquenessStatus: 'UNIQUE',
      methodologyId: RESEARCH_METHODOLOGY_V1.methodologyId,
      methodologyVersion: RESEARCH_METHODOLOGY_V1.methodologyVersion,
    });
    const inputV2 = buildVerifiedHumanEconomicContributionInput({
      registryRecord: record,
      humanEconomicClaimId: `claim.${seed}`,
      canonicalEventId: record.event.eventReference,
      verificationReceiptRef: `vreceipt.${seed}`,
      identityAssuranceLevel: 'STANDARD',
      evidenceProofRefs: [`evidence.proof.${seed}`],
      rightsProofRefs: [],
      consentProofRefs: [`consent.proof.${seed}`],
      policyProofRefs: [`policy.proof.${seed}`],
      authorizedScope: 'research-participation.simulation',
      uniquenessStatus: 'UNIQUE',
      methodologyId: RESEARCH_METHODOLOGY_V1.methodologyId,
      methodologyVersion: asValuationPolicyVersion('2'),
    });
    const policy = createSimulationValuationPolicy();
    const references = [referenceFor('RESEARCH_PARTICIPATION_SCHEDULE', seed, 5_000n)];
    const engine = new HumanEconomicValueEngine(new InMemoryValuationReferenceDataPort(references));
    const v1 = engine.evaluate({
      valuationInput: inputV1,
      policy,
      valuationTimestamp: VALUATION_NOW,
      policyReference: 'policy.sim.research-valuation.unconfigured',
    });
    const v2 = engine.evaluate({
      valuationInput: inputV2,
      policy,
      valuationTimestamp: VALUATION_NOW,
      policyReference: 'policy.sim.research-valuation.unconfigured',
    });
    assert.equal(v1.ok, true);
    assert.equal(v2.ok, false);
    if (!v2.ok) {
      assert.equal(v2.code, 'METHODOLOGY_MISMATCH');
    }
  });

  it('rejects unverified contribution', () => {
    const record = verifyFixture('RESEARCH_PARTICIPATION', 'wave6-unverified', 1n);
    const rejected = { ...record, status: 'SUBMITTED' as const };
    const input = buildVerifiedHumanEconomicContributionInput({
      registryRecord: rejected,
      humanEconomicClaimId: 'claim.unverified',
      canonicalEventId: rejected.event.eventReference,
      verificationReceiptRef: 'vreceipt.unverified',
      identityAssuranceLevel: 'STANDARD',
      evidenceProofRefs: ['evidence.1'],
      rightsProofRefs: [],
      consentProofRefs: ['consent.1'],
      policyProofRefs: ['policy.1'],
      authorizedScope: 'research',
      uniquenessStatus: 'UNIQUE',
      methodologyId: RESEARCH_METHODOLOGY_V1.methodologyId,
      methodologyVersion: RESEARCH_METHODOLOGY_V1.methodologyVersion,
    });
    const engine = new HumanEconomicValueEngine(new InMemoryValuationReferenceDataPort([]));
    const result = engine.evaluate({
      valuationInput: input,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
      policyReference: 'policy.sim',
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'CONTRIBUTION_NOT_VERIFIED');
    }
  });

  it('rejects duplicate contribution', () => {
    const seed = 'wave6-duplicate';
    const input = researchInput(seed);
    const policy = createSimulationValuationPolicy();
    const references = [referenceFor('RESEARCH_PARTICIPATION_SCHEDULE', seed, 5_000n)];
    const engine = new HumanEconomicValueEngine(new InMemoryValuationReferenceDataPort(references));
    const first = engine.evaluate({
      valuationInput: input,
      policy,
      valuationTimestamp: VALUATION_NOW,
      policyReference: 'policy.sim',
    });
    assert.equal(first.ok, true);
    const duplicate = engine.evaluate({
      valuationInput: input,
      policy,
      valuationTimestamp: VALUATION_NOW,
      policyReference: 'policy.sim',
    });
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) {
      assert.equal(duplicate.code, 'DUPLICATE_CONTRIBUTION');
    }
  });

  it('rejects wrong rights for authorized-data-use methodology', () => {
    const record = verifyFixture('INFORMATION_RIGHT_CONTRIBUTION', 'wave6-rights', 2n);
    const input = buildVerifiedHumanEconomicContributionInput({
      registryRecord: record,
      humanEconomicClaimId: 'claim.rights',
      canonicalEventId: record.event.eventReference,
      verificationReceiptRef: 'vreceipt.rights',
      identityAssuranceLevel: 'STANDARD',
      evidenceProofRefs: ['evidence.1'],
      rightsProofRefs: [],
      consentProofRefs: ['consent.1'],
      policyProofRefs: ['policy.1'],
      authorizedScope: 'data-use',
      uniquenessStatus: 'UNIQUE',
      methodologyId: AUTHORIZED_DATA_USE_METHODOLOGY_V1.methodologyId,
      methodologyVersion: AUTHORIZED_DATA_USE_METHODOLOGY_V1.methodologyVersion,
    });
    const engine = new HumanEconomicValueEngine(new InMemoryValuationReferenceDataPort([]));
    const result = engine.evaluate({
      valuationInput: input,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
      policyReference: 'policy.sim.data-use',
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'RIGHTS_PROOF_MISSING');
    }
  });

  it('rejects AI output as canonical PEVE input', () => {
    const input = researchInput('wave6-ai');
    const engine = new HumanEconomicValueEngine(new InMemoryValuationReferenceDataPort([]));
    const result = engine.evaluate({
      valuationInput: input,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
      policyReference: 'policy.sim',
      extra: { actorKind: 'AI', aiSubjectiveScore: 99n },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'AI_OUTPUT_CANNOT_SET_PEVE');
    }
    const refused = refuseAiCanonicalPeveInput('test');
    assert.equal(refused.code, 'AI_OUTPUT_CANNOT_SET_PEVE');
    const assist = aiPeveAssist({
      task: 'EXPLAIN',
      contributionId: input.contribution.contributionId,
      evidenceDigest: input.contribution.evidenceDigest,
      modelOutputDigest: 'model.digest',
    });
    assert.equal(assist.becomesCanonicalPeveInput, false);
    assert.equal(PEVE_AI_ROLE.maySetCanonicalPeveMonetaryInput, false);
  });

  it('market price change does not alter PEVE', () => {
    const seed = 'wave6-market';
    const input = researchInput(seed);
    const policy = createSimulationValuationPolicy();
    const references = [referenceFor('RESEARCH_PARTICIPATION_SCHEDULE', seed, 5_000n)];
    const engine = new HumanEconomicValueEngine(new InMemoryValuationReferenceDataPort(references));
    const before = engine.evaluate({
      valuationInput: input,
      policy,
      valuationTimestamp: VALUATION_NOW,
      policyReference: 'policy.sim',
    });
    assert.equal(before.ok, true);
    const marketRejection = rejectMarketPriceAsPeveInput({ exchangePriceMinorUnits: 100n });
    assert.equal(marketRejection?.code, 'MARKET_PRICE_INPUT_FORBIDDEN');
    const marketBlocked = engine.evaluate({
      valuationInput: input,
      policy,
      valuationTimestamp: VALUATION_NOW,
      policyReference: 'policy.sim',
      extra: { exchangePriceMinorUnits: 100n },
    });
    assert.equal(marketBlocked.ok, false);
    if (!marketBlocked.ok) {
      assert.equal(marketBlocked.code, 'MARKET_PRICE_INPUT_FORBIDDEN');
    }
    if (!before.ok) {
      return;
    }
    assert.equal(
      peveInvariantUnderMarketPriceChange(
        before.result,
        before.result,
        { exchangePriceMinorUnits: 1n, marketCapMinorUnits: 1n, observedAtUtc: VALUATION_NOW },
        { exchangePriceMinorUnits: 999_999n, marketCapMinorUnits: 999_999n, observedAtUtc: VALUATION_NOW },
      ),
      true,
    );
    assert.equal(peveResultExcludesMarketPrice(before.result), true);
  });

  it('MoonRey GPUV cannot substitute for PEVE', () => {
    const gpuv = rejectGpuvAsPeveSubstitute({ gpuvMinorUnits: 10_000n, productiveClaimId: 'claim.gpuv' });
    assert.equal(gpuv.code, 'GPUV_CANNOT_SUBSTITUTE_PEVE');
    const input = researchInput('wave6-gpuv');
    const engine = new HumanEconomicValueEngine(new InMemoryValuationReferenceDataPort([]));
    const result = engine.evaluate({
      valuationInput: input,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
      policyReference: 'policy.sim',
      extra: { gpuvQuantity: { gpuvMinorUnits: 10_000n, productiveClaimId: 'claim.gpuv' } },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'GPUV_CANNOT_SUBSTITUTE_PEVE');
    }
  });

  it('rejects sensitive unrelated attribute altering valuation', () => {
    const input = workInput('wave6-trait');
    const engine = new HumanEconomicValueEngine(new InMemoryValuationReferenceDataPort([]));
    const result = engine.evaluate({
      valuationInput: input,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
      policyReference: 'policy.sim',
      extra: { ethnicity: 'forbidden-proxy' },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'PROTECTED_TRAIT_INPUT_FORBIDDEN');
    }
  });

  it('human-worth fields remain prohibited on receipt and result', () => {
    const seed = 'wave6-worth';
    const input = workInput(seed);
    const policy = createSimulationValuationPolicy();
    const references = [referenceFor('PROFESSIONAL_SERVICE_SCHEDULE', seed, 4_000n)];
    const engine = new HumanEconomicValueEngine(new InMemoryValuationReferenceDataPort(references));
    const valued = engine.evaluate({
      valuationInput: input,
      policy,
      valuationTimestamp: VALUATION_NOW,
      policyReference: 'policy.sim.work-valuation.unconfigured',
    });
    assert.equal(valued.ok, true);
    if (!valued.ok) {
      return;
    }
    assert.equal(valued.result.humanWorthAssigned, false);
    assert.equal(valued.result.humanWorthScore, false);
    assert.equal(valued.result.sunReyQuantity, null);
    assert.equal(valued.receipt.humanWorthAssigned, false);
    assert.equal(valued.receipt.humanWorthScore, false);
    assert.equal(valued.receipt.peveScoreUsedAsValue, false);
    assert.equal(valued.receipt.sunReyQuantity, null);
    assert.equal(valued.receipt.environmentStatus, 'SIMULATION');
    assert.ok(valued.receipt.resultCommitment.length > 0);
  });

  it('exposes versioned simulation methodologies without approved production formulas', () => {
    const research = resolveMethodology(
      RESEARCH_METHODOLOGY_V1.methodologyId,
      RESEARCH_METHODOLOGY_V1.methodologyVersion,
    );
    assert.ok(research);
    assert.equal(research.productionApproved, false);
    assert.equal(research.formulaApproved, false);
    assert.equal(EDUCATION_METHODOLOGY_V1.approvalStatus, 'SIMULATION_ONLY');
    assert.equal(COMPUTATION_METHODOLOGY_V1.requiresRightsProof, true);
    assert.equal(refuseProductionPeve().code, 'PRODUCTION_PEVE_UNAVAILABLE');
  });

  it('produces valuation receipt with required fields', () => {
    const seed = 'wave6-receipt';
    const input = researchInput(seed);
    const policy = createSimulationValuationPolicy();
    const references = [referenceFor('RESEARCH_PARTICIPATION_SCHEDULE', seed, 5_000n)];
    const engine = new HumanEconomicValueEngine(new InMemoryValuationReferenceDataPort(references));
    const valued = engine.evaluate({
      valuationInput: input,
      policy,
      valuationTimestamp: VALUATION_NOW,
      policyReference: 'policy.sim.research-valuation.unconfigured',
    });
    assert.equal(valued.ok, true);
    if (!valued.ok) {
      return;
    }
    assert.equal(valued.receipt.valuationId, valued.result.valuationId);
    assert.equal(valued.receipt.humanEconomicClaimId, input.humanEconomicClaimId);
    assert.equal(valued.receipt.contributionId, valued.result.contributionId);
    assert.equal(valued.receipt.methodologyId, RESEARCH_METHODOLOGY_V1.methodologyId);
    assert.equal(valued.receipt.verificationReceiptRef, input.verificationReceiptRef);
    assert.ok(valued.receipt.authorizedInputsDigest.length > 0);
  });

  it('delegates valuation computation to the Chunk 111 engine', () => {
    const seed = 'wave6-delegate';
    const record = verifyFixture('COMMUNITY_CONTRIBUTION', seed, 4n);
    const chunk111 = engineWith([referenceFor('COMMUNITY_CONTRIBUTION_SCHEDULE', seed, 2_500n)]).evaluate({
      contribution: record,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
    });
    assert.equal(chunk111.state, 'VALUED_SIMULATION');
    assert.equal(COMMUNITY_CONTRIBUTION_POLICY.status, 'SIMULATION');
  });
});
