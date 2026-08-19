import { asUtcInstant } from '../../domain/src/time.ts';
import { fixtureContribution, FIXTURE_SUBJECT } from './fixtures.ts';
import { HumanContributionRegistry } from './registry.ts';
import {
  ENGINEERING_VERIFICATION_POLICY,
  PRODUCTION_LEGAL_COMMERCIAL_POLICY,
  evidenceBundleFromRecord,
} from './verification/index.ts';

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }): T {
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

export function runHumanContributionVerificationDemo(): {
  readonly VALUATION_PERFORMED: false;
  readonly SUNREY_QUANTITY_CALCULATED: false;
  readonly HUMAN_WORTH_SCORE: false;
  readonly PRODUCTION_ACTIVATED: false;
} {
  const registry = new HumanContributionRegistry();
  const submitted = unwrap(registry.submit(fixtureContribution('INFORMATION_RIGHT_CONTRIBUTION', 'demo-verify-info')));
  const bundle = evidenceBundleFromRecord(submitted);
  const decision = unwrap(
    registry.evaluateVerification({
      contributionId: submitted.contributionId,
      verificationTimestamp: asUtcInstant('2026-08-19T12:15:00.000Z'),
    }),
  );
  const verified = unwrap(
    registry.applyVerificationDecision({
      decision,
      verificationTimestamp: asUtcInstant('2026-08-19T12:15:00.000Z'),
    }),
  );

  console.log('SunRey Human Contribution Verification (CHUNK-109)');
  console.log(`subjectRef=${FIXTURE_SUBJECT}`);
  console.log('');
  console.log('Path: contribution event → evidence bundle → policy evaluation → VERIFIED decision → registry');
  console.log(`contributionId=${submitted.contributionId}`);
  console.log(`bundleId=${bundle.bundleId} digest=${bundle.evidenceDigest.slice(0, 16)}…`);
  console.log(`policyId=${ENGINEERING_VERIFICATION_POLICY.policyId}`);
  console.log(`policyVersion=${ENGINEERING_VERIFICATION_POLICY.policyVersion}`);
  console.log(`parameterClass=${ENGINEERING_VERIFICATION_POLICY.parameterClass}`);
  console.log(`productionLegalCommercialPolicy=${PRODUCTION_LEGAL_COMMERCIAL_POLICY.productionLegalCommercialPolicy}`);
  console.log(`counselApproval=${PRODUCTION_LEGAL_COMMERCIAL_POLICY.counselApproval}`);
  console.log(`decision=${decision.decision} decisionId=${decision.decisionId}`);
  console.log(`registryStatus=${verified.status} verificationPolicyVersion=${verified.verificationPolicyVersion}`);
  console.log(`valuationPerformed=${String(decision.valuationPerformed)} sunReyQuantityCalculated=${String(decision.sunReyQuantityCalculated)}`);
  console.log('');

  const inferred = unwrap(
    registry.submit({
      ...fixtureContribution('COMMUNITY_CONTRIBUTION', 'demo-verify-model'),
      sourceClass: 'MODEL_INFERENCE',
    }),
  );
  const inferredDecision = unwrap(
    registry.evaluateVerification({
      contributionId: inferred.contributionId,
      verificationTimestamp: asUtcInstant('2026-08-19T12:16:00.000Z'),
    }),
  );
  console.log('MODEL_INFERENCE only → REJECTED');
  console.log(`decision=${inferredDecision.decision} codes=${inferredDecision.decisionCodes.join(',')}`);
  console.log('');

  const incomplete = unwrap(registry.submit(fixtureContribution('HUMAN_SERVICE_DELIVERY', 'demo-verify-missing')));
  const missingDecision = unwrap(
    registry.evaluateVerification({
      contributionId: incomplete.contributionId,
      verificationTimestamp: asUtcInstant('2026-08-19T12:17:00.000Z'),
      facts: {
        contributionFound: true,
        evaluatedAt: asUtcInstant('2026-08-19T12:17:00.000Z'),
        rights: [],
        consents: [],
        purposes: [],
        usageReceipts: [],
        attestations: [],
        provenance: [],
        evidenceItems: [],
        jurisdictionResolved: true,
        declaredSubjectRef: incomplete.subjectRef,
        declaredMeasurement: incomplete.event.measurement,
        declaredPeriod: incomplete.measurementPeriod,
        declaredSourceClass: incomplete.sourceClass,
        declaredFingerprint: incomplete.fingerprint,
        expectedFingerprint: incomplete.fingerprint,
        expectedEvidenceDigest: evidenceBundleFromRecord(incomplete).evidenceDigest,
        activeDuplicateFingerprint: false,
        invalidSupersession: false,
        rawPersonalDataPresent: false,
        protectedTraitRankingPresent: false,
        humanWorthScoringPresent: false,
        modelInferenceSoleAuthority: false,
        userDeclarationSoleAuthority: false,
        companyOwnershipAlone: false,
        modelTrainingPermission: false,
        usageRealized: false,
        eventPresent: false,
        serviceAccepted: false,
        royaltyContractPresent: false,
        creativeRightPresent: false,
        knowledgeArtifactPresent: false,
      },
    }),
  );
  console.log('missing evidence → REQUIRES_ADDITIONAL_EVIDENCE');
  console.log(`decision=${missingDecision.decision} codes=${missingDecision.decisionCodes.join(',')}`);
  console.log('');
  console.log('VALUATION_PERFORMED=false');
  console.log('SUNREY_QUANTITY_CALCULATED=false');
  console.log('HUMAN_WORTH_SCORE=false');
  console.log('PRODUCTION_ACTIVATED=false');

  return {
    VALUATION_PERFORMED: false,
    SUNREY_QUANTITY_CALCULATED: false,
    HUMAN_WORTH_SCORE: false,
    PRODUCTION_ACTIVATED: false,
  };
}

runHumanContributionVerificationDemo();
