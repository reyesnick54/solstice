import { asUtcInstant } from '../../../domain/src/time.ts';
import {
  interpretProviderScore,
  normalizeComplianceVendorResponse,
  providerScoreIsNotKernelDecision,
} from '../../../kernel/src/compliance/provider-candidate/normalization.ts';
import { FAIL_CLOSED_OUTCOMES } from '../../../kernel/src/compliance/provider-candidate/types.ts';
import {
  aiMayApproveCompliance,
  attemptComplianceHumanReview,
  grokMayApproveCompliance,
  s3mMayApproveCompliance,
} from '../../../kernel/src/compliance/provider-candidate/review.ts';
import { runProductionAttack, safetyScenario } from './production-helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';
import type { RangeEnvironment } from '../environment.ts';
import type { ScreeningRequest } from '../../../kernel/src/compliance/ports.ts';

const INVARIANTS = [
  'COMPLIANCE_UNAVAILABLE_NOT_CLEAR',
  'KERNEL_CANNOT_BE_BYPASSED',
  'AI_CANNOT_EXECUTE',
  'NO_REGULATORY_BYPASS',
] as const;

export const complianceAttackScenarios: readonly AttackScenario[] = [
  'COMPLY-KYC-UNAVAILABLE-REWRITE',
  'COMPLY-SANCTIONS-TIMEOUT-CLEAR',
  'COMPLY-PEP-SUPPRESSED',
  'COMPLY-AML-UNAVAILABLE',
  'COMPLY-MALFORMED-SCORE',
  'COMPLY-PROVIDER-AS-KERNEL-ALLOW',
  'COMPLY-AI-COUNSEL-REVIEW',
  'COMPLY-ADVERSE-MEDIA-CRIMINAL',
].map((scenarioId, index) =>
  safetyScenario({
    scenarioId,
    seed: 15820 + index,
    category: 'COMPLIANCE_ABUSE',
    subsystem: 'compliance',
    attack: scenarioId.toLowerCase().replace('comply-', '').replaceAll('-', ' '),
    invariants: INVARIANTS,
    detection: 'COMPLIANCE_FAIL_CLOSED',
    recovery: 'COMPLIANCE_HOLD',
  }),
);

function request(): ScreeningRequest {
  return {
    subjectKind: 'PERSON',
    subjectRef: 'cus_range_1',
    jurisdiction: 'US',
    now: asUtcInstant('2026-08-20T00:00:00.000Z'),
  };
}

export function runComplianceAttack(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  return runProductionAttack(env, scenario, () => {
    const req = request();
    const unavailable = normalizeComplianceVendorResponse({ scenario: 'unavailable' }, req, 'fixture-kyc');
    const timeout = normalizeComplianceVendorResponse({ scenario: 'timeout' }, req, 'fixture-sanctions');
    const pep = normalizeComplianceVendorResponse({ scenario: 'potential_match' }, req, 'fixture-pep');
    const aml = normalizeComplianceVendorResponse({ scenario: 'unavailable' }, req, 'fixture-aml');
    const malformed = normalizeComplianceVendorResponse({ scenario: 'score_overflow', vendorScore: Number.POSITIVE_INFINITY }, req, 'fixture-aml');
    const score = interpretProviderScore(12, 0.4);
    const aiReview = attemptComplianceHumanReview({
      case: { caseId: 'case_1' } as never,
      actorKind: 'AI',
      decision: 'CLEAR',
      now: req.now,
    });
    const failClosed =
      unavailable.outcome !== 'CLEAR' &&
      timeout.outcome !== 'CLEAR' &&
      aml.outcome !== 'CLEAR' &&
      malformed.outcome !== 'CLEAR' &&
      FAIL_CLOSED_OUTCOMES.includes(unavailable.outcome) &&
      pep.outcome === 'REVIEW' &&
      score.isKernelDecision === false &&
      providerScoreIsNotKernelDecision() === false &&
      aiMayApproveCompliance() === false &&
      grokMayApproveCompliance() === false &&
      s3mMayApproveCompliance() === false &&
      'ok' in aiReview && aiReview.ok === false;
    return {
      blocked: failClosed,
      safetyHeld: failClosed,
      livenessDegraded: true,
      detail: `${scenario.scenarioId} kyc=${unavailable.outcome} sanctions=${timeout.outcome} pep=${pep.outcome} scoreKernel=${String(score.isKernelDecision)}`,
    };
  });
}
