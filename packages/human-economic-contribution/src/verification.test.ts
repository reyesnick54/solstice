import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import { fixtureContribution, FIXTURE_NOW } from './fixtures.ts';
import { DEFAULT_VERIFICATION_POLICY_VERSION, fingerprintEconomicEvent } from './fingerprint.ts';
import { attestationRefFor, evidenceRefFor, subjectRefFor } from './ids.ts';
import { HumanContributionRegistry } from './registry.ts';
import {
  ENGINEERING_VERIFICATION_POLICY,
  HUMAN_CONTRIBUTION_EVIDENCE_SCHEMA_VERSION,
  HumanContributionVerificationEngine,
  PRODUCTION_LEGAL_COMMERCIAL_POLICY,
  bundleFromInformationRightEvidence,
  createHumanContributionEvidenceBundle,
  decideVerification,
  defaultFactsFromRecord,
  digestEvidenceBundleInput,
  evidenceBundleFromRecord,
  factsFromInformationRightEvidence,
  withExpectedDigest,
  type HumanContributionEvidenceFacts,
  type PrivacySafeInformationRightEvidence,
} from './verification/index.ts';
import type { HumanContributionRegistryRecord } from './types.ts';

const LATER = asUtcInstant('2026-08-19T12:05:00.000Z');

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } }): T {
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

function submit(registry: HumanContributionRegistry, seed: string, contributionClass: Parameters<typeof fixtureContribution>[0]) {
  return unwrap(registry.submit(fixtureContribution(contributionClass, seed)));
}

function verify(registry: HumanContributionRegistry, contributionId: HumanContributionRegistryRecord['contributionId'], facts?: HumanContributionEvidenceFacts) {
  return registry.verify({
    contributionId,
    verificationTimestamp: LATER,
    verificationPolicyVersion: DEFAULT_VERIFICATION_POLICY_VERSION,
    ...(facts ? { facts } : {}),
  });
}

function factsFor(record: HumanContributionRegistryRecord, extras: Partial<HumanContributionEvidenceFacts> = {}): HumanContributionEvidenceFacts {
  const bundle = evidenceBundleFromRecord(record);
  const facts = defaultFactsFromRecord(record, LATER, extras);
  if (extras.expectedEvidenceDigest !== undefined) {
    return facts;
  }
  return withExpectedDigest(facts, bundle.evidenceDigest);
}

function hinEvidence(seed: string): PrivacySafeInformationRightEvidence {
  return {
    contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION',
    subjectPseudonymousRef: `synthetic-${seed}`,
    descriptorId: `desc_${seed}`,
    rightId: `right_${seed}`,
    consentRef: `consent_${seed}`,
    purposeRef: `purpose_${seed}`,
    usageReceiptId: `receipt_${seed}`,
    usageReceiptHash: `hash_${seed}`,
    approvedComputationId: `comp_${seed}`,
    approvedComputationHash: `comp-hash_${seed}`,
    approvedComputationResultId: `result_${seed}`,
    settlementRef: null,
    evidenceDigest: `digest_${seed}`,
    occurredAt: FIXTURE_NOW,
    rawPersonalData: false,
    mintRequested: false,
    unrestrictedIssuance: false,
    automaticSunReyMint: false,
  };
}

describe('CHUNK-109 human contribution verification', () => {
  const engine = new HumanContributionVerificationEngine(ENGINEERING_VERIFICATION_POLICY);

  it('1. verifies a valid information-right contribution', () => {
    const registry = new HumanContributionRegistry();
    const submitted = submit(registry, 'info-ok', 'INFORMATION_RIGHT_CONTRIBUTION');
    const verified = unwrap(verify(registry, submitted.contributionId));
    assert.equal(verified.status, 'VERIFIED');
    assert.equal(verified.verificationPolicyVersion, ENGINEERING_VERIFICATION_POLICY.policyVersion);
    assert.equal(verified.sunReyQuantity, null);
    assert.equal(verified.valuationAmount, null);
  });

  it('2. verifies valid creative production', () => {
    const registry = new HumanContributionRegistry();
    const submitted = submit(registry, 'creative-ok', 'CREATIVE_PRODUCTION');
    assert.equal(unwrap(verify(registry, submitted.contributionId)).status, 'VERIFIED');
  });

  it('3. verifies valid research participation', () => {
    const registry = new HumanContributionRegistry();
    const submitted = submit(registry, 'research-ok', 'RESEARCH_PARTICIPATION');
    assert.equal(unwrap(verify(registry, submitted.contributionId)).status, 'VERIFIED');
  });

  it('4. verifies valid professional expertise', () => {
    const registry = new HumanContributionRegistry();
    const submitted = submit(registry, 'pro-ok', 'PROFESSIONAL_EXPERTISE');
    assert.equal(unwrap(verify(registry, submitted.contributionId)).status, 'VERIFIED');
  });

  it('5. verifies valid community contribution', () => {
    const registry = new HumanContributionRegistry();
    const submitted = submit(registry, 'community-ok', 'COMMUNITY_CONTRIBUTION');
    assert.equal(unwrap(verify(registry, submitted.contributionId)).status, 'VERIFIED');
  });

  it('6. verifies valid human-service delivery', () => {
    const registry = new HumanContributionRegistry();
    const submitted = submit(registry, 'service-ok', 'HUMAN_SERVICE_DELIVERY');
    assert.equal(unwrap(verify(registry, submitted.contributionId)).status, 'VERIFIED');
  });

  it('7. verifies model-training participation with explicit permission', () => {
    const registry = new HumanContributionRegistry();
    const submitted = submit(registry, 'train-ok', 'MODEL_TRAINING_PARTICIPATION');
    assert.equal(unwrap(verify(registry, submitted.contributionId)).status, 'VERIFIED');
  });

  it('8. missing evidence returns REQUIRES_ADDITIONAL_EVIDENCE', () => {
    const registry = new HumanContributionRegistry();
    const submitted = submit(registry, 'missing-ev', 'HUMAN_SERVICE_DELIVERY');
    const decision = unwrap(
      registry.evaluateVerification({
        contributionId: submitted.contributionId,
        verificationTimestamp: LATER,
        facts: factsFor(submitted, {
          eventPresent: false,
          serviceAccepted: false,
        }),
      }),
    );
    assert.equal(decision.decision, 'REQUIRES_ADDITIONAL_EVIDENCE');
    assert.ok(decision.decisionCodes.includes('EVIDENCE_MISSING'));
    const applied = registry.applyVerificationDecision({ decision });
    assert.equal(applied.ok, false);
    if (!applied.ok) {
      assert.equal(applied.error.code, 'REQUIRES_ADDITIONAL_EVIDENCE');
    }
  });

  it('9. stale evidence is rejected', () => {
    const registry = new HumanContributionRegistry();
    const submitted = submit(registry, 'stale-ev', 'CREATIVE_PRODUCTION');
    const rejected = verify(
      registry,
      submitted.contributionId,
      factsFor(submitted, {
        evidenceItems: submitted.evidenceReferences.map((ref) => ({
          ref,
          createdAt: asUtcInstant('2024-01-01T00:00:00.000Z'),
          stale: true,
          conflicted: false,
          digest: submitted.evidenceDigest,
        })),
      }),
    );
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.error.code, 'EVIDENCE_STALE');
    }
  });

  it('10. conflicted evidence is rejected', () => {
    const registry = new HumanContributionRegistry();
    const submitted = submit(registry, 'conflict-ev', 'CREATIVE_PRODUCTION');
    const rejected = verify(
      registry,
      submitted.contributionId,
      factsFor(submitted, {
        evidenceItems: submitted.evidenceReferences.map((ref) => ({
          ref,
          createdAt: submitted.createdAt,
          stale: false,
          conflicted: true,
          digest: submitted.evidenceDigest,
        })),
      }),
    );
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.error.code, 'EVIDENCE_CONFLICTED');
    }
  });

  it('11. missing consent is rejected', () => {
    const registry = new HumanContributionRegistry();
    const submitted = submit(registry, 'no-consent', 'INFORMATION_RIGHT_CONTRIBUTION');
    const rejected = verify(
      registry,
      submitted.contributionId,
      factsFor(submitted, {
        consents: [],
      }),
    );
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.ok(['CONSENT_REQUIRED', 'REQUIRES_ADDITIONAL_EVIDENCE'].includes(rejected.error.code));
    }
  });

  it('12. purpose mismatch is rejected', () => {
    const registry = new HumanContributionRegistry();
    const submitted = submit(registry, 'purpose-bad', 'INFORMATION_RIGHT_CONTRIBUTION');
    const rejected = verify(
      registry,
      submitted.contributionId,
      factsFor(submitted, {
        purposes: submitted.purposeReferences.map((ref) => ({ ref, bound: true, matchesUsage: false })),
      }),
    );
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.error.code, 'PURPOSE_MISMATCH');
    }
  });

  it('13. revoked-before-use is rejected', () => {
    const registry = new HumanContributionRegistry();
    const submitted = submit(registry, 'revoked-use', 'INFORMATION_RIGHT_CONTRIBUTION');
    const rejected = verify(
      registry,
      submitted.contributionId,
      factsFor(submitted, {
        rights: submitted.rightsReferences.map((ref) => ({
          ref,
          valid: false,
          expired: false,
          revokedBeforeUse: true,
          subjectRef: submitted.subjectRef,
          purposeRef: submitted.purposeReferences[0] ?? null,
        })),
      }),
    );
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.error.code, 'RIGHT_REVOKED_BEFORE_USE');
    }
  });

  it('14. later revocation preserves a historically verified event', () => {
    const registry = new HumanContributionRegistry();
    const submitted = submit(registry, 'hist-rev', 'INFORMATION_RIGHT_CONTRIBUTION');
    const verified = unwrap(verify(registry, submitted.contributionId));
    assert.equal(verified.status, 'VERIFIED');
    const afterRevocation = unwrap(
      registry.evaluateVerification({
        contributionId: submitted.contributionId,
        verificationTimestamp: asUtcInstant('2026-08-20T12:00:00.000Z'),
        facts: factsFor(submitted, {
          rights: submitted.rightsReferences.map((ref) => ({
            ref,
            valid: false,
            expired: false,
            revokedBeforeUse: false,
            subjectRef: submitted.subjectRef,
            purposeRef: submitted.purposeReferences[0] ?? null,
          })),
        }),
      }),
    );
    assert.equal(registry.getRecord(submitted.contributionId)?.status, 'VERIFIED');
    assert.equal(registry.getVerifiedReference(submitted.contributionId)?.status, 'VERIFIED');
    assert.notEqual(afterRevocation.decision, undefined);
  });

  it('15. user declaration alone is rejected', () => {
    const registry = new HumanContributionRegistry();
    const submitted = unwrap(
      registry.submit({
        ...fixtureContribution('COMMUNITY_CONTRIBUTION', 'user-only'),
        sourceClass: 'USER_DECLARED',
      }),
    );
    const rejected = verify(registry, submitted.contributionId);
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.error.code, 'USER_DECLARATION_INSUFFICIENT');
    }
  });

  it('16. model inference alone is rejected', () => {
    const registry = new HumanContributionRegistry();
    const submitted = unwrap(
      registry.submit({
        ...fixtureContribution('COMMUNITY_CONTRIBUTION', 'model-only'),
        sourceClass: 'MODEL_INFERENCE',
      }),
    );
    const rejected = verify(registry, submitted.contributionId);
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.error.code, 'MODEL_INFERENCE_CANNOT_VERIFY');
    }
  });

  it('17. self-attestation is rejected where independence is required', () => {
    const registry = new HumanContributionRegistry();
    const submitted = submit(registry, 'self-att', 'COMMUNITY_CONTRIBUTION');
    const rejected = verify(
      registry,
      submitted.contributionId,
      factsFor(submitted, {
        attestations: submitted.event.attestationReferences.map((ref) => ({
          ref,
          approved: true,
          independent: false,
          attestorRef: submitted.subjectRef,
          subjectRef: submitted.subjectRef,
          conflictsWith: [],
        })),
      }),
    );
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.ok(['SELF_ATTESTATION_INSUFFICIENT', 'INDEPENDENT_ATTESTATION_REQUIRED'].includes(rejected.error.code));
    }
  });

  it('18. duplicate contribution is rejected', () => {
    const registry = new HumanContributionRegistry();
    const first = submit(registry, 'dup-verify', 'CREATIVE_PRODUCTION');
    unwrap(verify(registry, first.contributionId));
    const duplicateSubmit = registry.submit({
      ...fixtureContribution('CREATIVE_PRODUCTION', 'dup-verify'),
      createdAt: asUtcInstant('2026-08-19T14:00:00.000Z'),
    });
    assert.equal(duplicateSubmit.ok, false);
    if (!duplicateSubmit.ok) {
      assert.equal(duplicateSubmit.error.code, 'DUPLICATE_FINGERPRINT');
    }
    const second = submit(registry, 'dup-verify-eval', 'CREATIVE_PRODUCTION');
    const rejected = verify(registry, second.contributionId, factsFor(second, { activeDuplicateFingerprint: true }));
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.ok(['DUPLICATE_FINGERPRINT', 'DUPLICATE_CONTRIBUTION'].includes(rejected.error.code));
    }
  });

  it('19. raw personal data is rejected', () => {
    const registry = new HumanContributionRegistry();
    const submitted = submit(registry, 'raw-pd', 'CREATIVE_PRODUCTION');
    const rejected = verify(registry, submitted.contributionId, factsFor(submitted, { rawPersonalDataPresent: true }));
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.error.code, 'RAW_PERSONAL_DATA_FORBIDDEN');
    }
  });

  it('20. protected-trait ranking is rejected', () => {
    const registry = new HumanContributionRegistry();
    const submitted = submit(registry, 'trait', 'PROFESSIONAL_EXPERTISE');
    const rejected = verify(registry, submitted.contributionId, factsFor(submitted, { protectedTraitRankingPresent: true }));
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.error.code, 'PROTECTED_TRAIT_RANKING_FORBIDDEN');
    }
  });

  it('21-22. verification and evidence digest are deterministic', () => {
    const registry = new HumanContributionRegistry();
    const submitted = submit(registry, 'det-1', 'RESEARCH_PARTICIPATION');
    const first = unwrap(registry.evaluateVerification({ contributionId: submitted.contributionId, verificationTimestamp: LATER }));
    const second = unwrap(registry.evaluateVerification({ contributionId: submitted.contributionId, verificationTimestamp: LATER }));
    assert.deepEqual(first, second);
    const left = evidenceBundleFromRecord(submitted);
    const right = createHumanContributionEvidenceBundle({
      contributionId: submitted.contributionId,
      subjectRef: submitted.subjectRef,
      contributionClass: submitted.contributionClass,
      sourceClass: submitted.sourceClass,
      eventReference: submitted.event.eventReference,
      measurement: submitted.event.measurement,
      measurementUnit: submitted.measurementUnit,
      measurementPeriod: submitted.measurementPeriod,
      evidenceReferences: [...submitted.evidenceReferences].reverse(),
      rightsReferences: [...submitted.rightsReferences].reverse(),
      consentReferences: [...submitted.consentReferences].reverse(),
      purposeReferences: [...submitted.purposeReferences].reverse(),
      usageReceiptReferences: [...submitted.event.usageReceiptReferences].reverse(),
      attestationReferences: [...submitted.event.attestationReferences].reverse(),
      provenanceReferences: [...submitted.provenanceReferences].reverse(),
      policyDecisionReferences: [],
      jurisdiction: submitted.jurisdiction,
      createdAt: submitted.createdAt,
    });
    assert.equal(left.evidenceDigest, right.evidenceDigest);
    assert.equal(digestEvidenceBundleInput(left), left.evidenceDigest);
    assert.equal(left.schemaVersion, HUMAN_CONTRIBUTION_EVIDENCE_SCHEMA_VERSION);
  });

  it('23. registry cannot be forced to VERIFIED by status or timestamp', () => {
    const registry = new HumanContributionRegistry();
    const forced = registry.record({
      ...fixtureContribution('CREATIVE_PRODUCTION', 'force-status'),
      status: 'VERIFIED',
    });
    assert.equal(forced.ok, false);
    if (!forced.ok) {
      assert.equal(forced.error.code, 'VERIFICATION_POLICY_REQUIRED');
    }
    const submitted = submit(registry, 'force-ts', 'CREATIVE_PRODUCTION');
    assert.notEqual(submitted.status, 'VERIFIED');
    const manufactured: Parameters<HumanContributionRegistry['applyVerificationDecision']>[0]['decision'] = {
      decisionId: submitted.registryRecordId as never,
      contributionId: submitted.contributionId,
      fingerprint: submitted.fingerprint,
      policyId: ENGINEERING_VERIFICATION_POLICY.policyId,
      policyVersion: ENGINEERING_VERIFICATION_POLICY.policyVersion,
      decision: 'REQUIRES_ADDITIONAL_EVIDENCE',
      evaluatedEvidenceRefs: submitted.evidenceReferences,
      evidenceDigest: evidenceBundleFromRecord(submitted).evidenceDigest,
      quality: 'INCOMPLETE',
      confidenceClass: 'INSUFFICIENT',
      decisionCodes: ['EVIDENCE_MISSING'],
      evaluatedAt: LATER,
      containsRawPersonalData: false,
      valuationPerformed: false,
      sunReyQuantityCalculated: false,
      mintAuthorityCreated: false,
      executionAuthorityCreated: false,
    };
    const applied = registry.applyVerificationDecision({ decision: manufactured, verificationTimestamp: LATER });
    assert.equal(applied.ok, false);
  });

  it('24. correction and supersession remain traceable', () => {
    const registry = new HumanContributionRegistry();
    const original = submit(registry, 'corr-v', 'PROFESSIONAL_EXPERTISE');
    unwrap(verify(registry, original.contributionId));
    const correction = unwrap(
      registry.correct(original.contributionId, {
        ...fixtureContribution('PROFESSIONAL_EXPERTISE', 'corr-v-2'),
        createdAt: asUtcInstant('2026-08-19T13:00:00.000Z'),
        measurementQuantity: 3n,
      }),
    );
    unwrap(verify(registry, correction.contributionId));
    const prior = registry.getRecord(original.contributionId);
    assert.equal(prior?.status, 'CORRECTED');
    assert.equal(correction.corrects, original.contributionId);
    assert.equal(registry.history(correction.contributionId).length, 2);
    assert.equal(registry.getVerifiedReference(original.contributionId), undefined);
    assert.ok(registry.getVerifiedReference(correction.contributionId));
  });

  it('25. HIN integration passes through the verifier', () => {
    const evidence = hinEvidence('hin-path');
    const bundle = bundleFromInformationRightEvidence(evidence);
    const fingerprint = fingerprintEconomicEvent({
      subjectRef: bundle.subjectRef,
      contributionClass: bundle.contributionClass,
      eventReference: bundle.eventReference,
      validFrom: bundle.measurementPeriod.start,
      validUntil: bundle.measurementPeriod.end,
      measurementQuantity: bundle.measurement.quantity,
      measurementUnit: bundle.measurementUnit,
      jurisdiction: bundle.jurisdiction,
      sourceClass: bundle.sourceClass,
    });
    const facts = factsFromInformationRightEvidence(evidence, bundle, {
      declaredFingerprint: fingerprint,
      expectedFingerprint: fingerprint,
    });
    const decision = engine.evaluate({ bundle, facts, fingerprint });
    assert.equal(decision.decision, 'VERIFIED');
    assert.equal(decision.valuationPerformed, false);
    const registry = new HumanContributionRegistry();
    const submitted = unwrap(
      registry.submit({
        contributionId: bundle.contributionId,
        subjectRef: bundle.subjectRef,
        contributionClass: bundle.contributionClass,
        sourceClass: bundle.sourceClass,
        eventReference: bundle.eventReference,
        measurementQuantity: bundle.measurement.quantity,
        measurementUnit: bundle.measurementUnit,
        validFrom: bundle.measurementPeriod.start,
        jurisdiction: bundle.jurisdiction,
        createdAt: bundle.createdAt,
        evidenceReferences: bundle.evidenceReferences,
        rightsReferences: bundle.rightsReferences,
        consentReferences: bundle.consentReferences,
        purposeReferences: bundle.purposeReferences,
        usageReceiptReferences: bundle.usageReceiptReferences,
      }),
    );
    const recorded = unwrap(registry.applyVerificationDecision({ decision: engine.evaluate({
      bundle: evidenceBundleFromRecord(submitted),
      facts: factsFor(submitted),
      fingerprint: submitted.fingerprint,
    }) }));
    assert.equal(recorded.status, 'VERIFIED');
    assert.equal(decision.policyVersion, ENGINEERING_VERIFICATION_POLICY.policyVersion);
  });

  it('26-27. decisions never include valuation or SunRey quantity', () => {
    const registry = new HumanContributionRegistry();
    const submitted = submit(registry, 'no-val', 'CREATIVE_PRODUCTION');
    const decision = unwrap(registry.evaluateVerification({ contributionId: submitted.contributionId, verificationTimestamp: LATER }));
    assert.equal(decision.valuationPerformed, false);
    assert.equal(decision.sunReyQuantityCalculated, false);
    assert.equal(decision.mintAuthorityCreated, false);
    assert.equal(decision.executionAuthorityCreated, false);
    assert.equal('sunReyQuantity' in decision, false);
    assert.equal(PRODUCTION_LEGAL_COMMERCIAL_POLICY.status, 'NOT_ACTIVATED');
    assert.equal(PRODUCTION_LEGAL_COMMERCIAL_POLICY.counselApproval, 'NOT_CLAIMED');
    assert.equal(ENGINEERING_VERIFICATION_POLICY.parameterClass, 'ENGINEERING_SIMULATION_PARAMETERS');
    const verified = unwrap(verify(registry, submitted.contributionId));
    assert.equal(verified.sunReyQuantity, null);
    assert.equal(verified.valuationAmount, null);
  });

  it('rejects OTHER_GOVERNED unless an active policy defines requirements', () => {
    const registry = new HumanContributionRegistry();
    const submitted = submit(registry, 'other-closed', 'OTHER_GOVERNED_HUMAN_CONTRIBUTION');
    const rejected = verify(registry, submitted.contributionId);
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.error.code, 'NOT_VERIFIABLE');
    }
  });

  it('rejects digest tampering, self-fingerprint replay, and human-worth scoring', () => {
    const registry = new HumanContributionRegistry();
    const submitted = submit(registry, 'tamper', 'CREATIVE_PRODUCTION');
    const tampered = verify(registry, submitted.contributionId, factsFor(submitted, { expectedEvidenceDigest: 'deadbeef' }));
    assert.equal(tampered.ok, false);
    const worth = verify(registry, submitted.contributionId, factsFor(submitted, { humanWorthScoringPresent: true }));
    assert.equal(worth.ok, false);
    if (!worth.ok) {
      assert.equal(worth.error.code, 'HUMAN_WORTH_SCORING_FORBIDDEN');
    }
    const replay = verify(
      registry,
      submitted.contributionId,
      factsFor(submitted, { expectedFingerprint: fingerprintEconomicEvent({
        subjectRef: subjectRefFor('other'),
        contributionClass: submitted.contributionClass,
        eventReference: submitted.event.eventReference,
        validFrom: submitted.measurementPeriod.start,
        validUntil: submitted.measurementPeriod.end,
        measurementQuantity: submitted.event.measurement.quantity,
        measurementUnit: submitted.measurementUnit,
        jurisdiction: submitted.jurisdiction,
        sourceClass: submitted.sourceClass,
      }) }),
    );
    assert.equal(replay.ok, false);
  });

  it('same policy evaluation is reproducible without valuation', () => {
    const registry = new HumanContributionRegistry();
    const submitted = submit(registry, 'repro', 'COMMUNITY_CONTRIBUTION');
    const bundle = evidenceBundleFromRecord(submitted);
    const facts = factsFor(submitted);
    const left = decideVerification({
      bundle,
      facts,
      fingerprint: submitted.fingerprint,
      policy: ENGINEERING_VERIFICATION_POLICY,
    });
    const right = decideVerification({
      bundle,
      facts,
      fingerprint: submitted.fingerprint,
      policy: ENGINEERING_VERIFICATION_POLICY,
    });
    assert.deepEqual(left, right);
    assert.equal(left.containsRawPersonalData, false);
    assert.equal(attestationRefFor('repro').startsWith('att_'), true);
    assert.equal(evidenceRefFor('repro').startsWith('hevr_'), true);
  });
});
