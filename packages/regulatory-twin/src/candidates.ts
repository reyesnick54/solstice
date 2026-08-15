import type { UtcInstant } from '../../domain/src/time.ts';
import {
  contentHashForRules,
  type PolicyPredicate,
  type PolicyRule,
  type PolicyVersionRecord,
} from '../../kernel/src/policy/index.ts';

function withHash(version: Omit<PolicyVersionRecord, 'contentHash'>): PolicyVersionRecord {
  return Object.freeze({
    ...version,
    contentHash: contentHashForRules(version),
    rules: Object.freeze(version.rules.map((rule) => Object.freeze({ ...rule }))),
  });
}

function copyRule(
  baseline: PolicyVersionRecord,
  patch: Partial<PolicyRule> & Pick<PolicyRule, 'ruleId' | 'effect' | 'reasonCode' | 'predicate'>,
): PolicyRule {
  const template = baseline.rules[0];
  if (!template) {
    throw new Error('candidate pack requires a baseline rule template');
  }
  const sourceReference = patch.sourceReference ?? template.sourceReference;
  return Object.freeze({
    ...template,
    ...patch,
    version: patch.version ?? '2',
    legalReviewStatus: patch.legalReviewStatus ?? 'RESEARCH_REQUIRED',
    ...(sourceReference ? { sourceReference } : {}),
  });
}

/**
 * Candidate V2: OPEN_ACCOUNT with kycRecordVersion === 1 requires review.
 * Baseline V1 remains ALLOW for verified customers.
 */
export function candidateUsOpenAccountReview(baseline: PolicyVersionRecord): PolicyVersionRecord {
  const predicate: PolicyPredicate = {
    op: 'eq',
    fact: 'identity.kycRecordVersion',
    value: 1,
  };
  return withHash({
    ...baseline,
    versionId: 'us-sim-v2-rdt-open-review',
    version: '2',
    lifecycle: 'DRAFT',
    legalReviewStatus: 'RESEARCH_REQUIRED',
    rules: [
      ...baseline.rules,
      copyRule(baseline, {
        ruleId: 'us-sim-v2-open-account-kyc-refresh-review',
        actionTypes: ['OPEN_ACCOUNT'],
        scope: 'account-opening',
        predicate,
        effect: 'REQUIRE_MANUAL_REVIEW',
        reasonCode: 'CANDIDATE_KYC_REFRESH_REVIEW',
        sourceReference: 'src-engineering-pack-shell',
      }),
    ],
  });
}

/**
 * Candidate corridor pack: INITIATE_PAYMENT defers when screening.fresh is missing.
 */
export function candidateUsCorridorEnhancedScreening(
  baseline: PolicyVersionRecord,
): PolicyVersionRecord {
  const predicate: PolicyPredicate = {
    op: 'missing',
    fact: 'screening.fresh',
  };
  return withHash({
    ...baseline,
    versionId: 'us-sim-v2-rdt-corridor-screening',
    version: '2',
    lifecycle: 'DRAFT',
    legalReviewStatus: 'RESEARCH_REQUIRED',
    rules: [
      ...baseline.rules,
      copyRule(baseline, {
        ruleId: 'us-sim-v2-corridor-enhanced-screening',
        actionTypes: ['INITIATE_PAYMENT'],
        scope: 'cross-border-payment',
        predicate,
        effect: 'DEFER',
        reasonCode: 'CANDIDATE_ENHANCED_SCREENING_REQUIRED',
        sourceReference: 'src-engineering-pack-shell',
      }),
    ],
  });
}

/**
 * Candidate that blocks counterparties marked HIGH_RISK. Used by the batch fixture.
 */
export function candidateUsHighRiskBeneficiaryBlock(
  baseline: PolicyVersionRecord,
): PolicyVersionRecord {
  const predicate: PolicyPredicate = {
    op: 'eq',
    fact: 'beneficiary.status',
    value: 'HIGH_RISK',
  };
  return withHash({
    ...baseline,
    versionId: 'us-sim-v2-rdt-high-risk-block',
    version: '2',
    lifecycle: 'DRAFT',
    legalReviewStatus: 'RESEARCH_REQUIRED',
    rules: [
      ...baseline.rules,
      copyRule(baseline, {
        ruleId: 'us-sim-v2-high-risk-beneficiary-block',
        actionTypes: ['INITIATE_PAYMENT'],
        scope: 'cross-border-payment',
        predicate,
        effect: 'BLOCK',
        reasonCode: 'CANDIDATE_HIGH_RISK_BENEFICIARY_BLOCK',
        sourceReference: 'src-engineering-pack-shell',
      }),
    ],
  });
}

/**
 * Combined batch candidate: KYC-refresh review + high-value payment block.
 */
export function candidateUsBatchImpact(baseline: PolicyVersionRecord): PolicyVersionRecord {
  const openReview = candidateUsOpenAccountReview(baseline);
  const highRisk = candidateUsHighRiskBeneficiaryBlock(baseline);
  const extra = highRisk.rules.filter(
    (rule) => !openReview.rules.some((existing) => existing.ruleId === rule.ruleId),
  );
  return withHash({
    ...baseline,
    versionId: 'us-sim-v2-rdt-batch-impact',
    version: '2',
    lifecycle: 'DRAFT',
    legalReviewStatus: 'RESEARCH_REQUIRED',
    rules: [...openReview.rules, ...extra],
  });
}

/**
 * Future-dated candidate used for effective-date simulation.
 */
export function candidateUsFutureEffective(
  baseline: PolicyVersionRecord,
  effectiveFrom: UtcInstant,
): PolicyVersionRecord {
  const review = candidateUsOpenAccountReview(baseline);
  return withHash({
    ...review,
    versionId: 'us-sim-v3-rdt-future',
    version: '3',
    effectiveFrom,
    rules: review.rules.map((rule) =>
      rule.ruleId === 'us-sim-v2-open-account-kyc-refresh-review'
        ? { ...rule, effectiveFrom }
        : rule,
    ),
  });
}

/**
 * Illegal candidate that would allow a sanctions hit. Invariant suite must fail.
 */
export function candidateUsSanctionsWeakened(baseline: PolicyVersionRecord): PolicyVersionRecord {
  return withHash({
    ...baseline,
    versionId: 'us-sim-v2-rdt-sanctions-weakened',
    version: '2',
    lifecycle: 'DRAFT',
    legalReviewStatus: 'RESEARCH_REQUIRED',
    rules: baseline.rules.map((rule) =>
      rule.ruleId === 'us-sim-sanctions-block'
        ? {
            ...rule,
            effect: 'ALLOW' as const,
            reasonCode: 'CANDIDATE_SANCTIONS_WEAKENED',
            overrideClass: 'REVIEWABLE' as const,
          }
        : rule,
    ),
  });
}
