import { randomUUID } from 'node:crypto';

import { ENVIRONMENT } from '../../../config/src/flags.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ActionIntent } from '../../../permissions/src/action-intent.ts';
import { DECISION_RANK, type DecisionStatus } from '../../../permissions/src/decision.ts';
import type { KernelFacts } from '../proofs.ts';
import {
  hashPolicyFacts,
  policyFactsFromKernel,
  resolveOfferingRefs,
  toFactMap,
  type PolicyFactInput,
} from './facts.ts';
import { resolveJurisdiction } from './jurisdiction.ts';
import { evaluatePredicate } from './predicates.ts';
import { PolicyRegistry, type PolicyEventSink } from './registry.ts';
import { ManualReviewRegistry, type ReviewDecisionInput, type ReviewDecisionResult } from './review.ts';
import type {
  EvaluatedRule,
  LegalReviewStatus,
  OverrideClass,
  PolicyEvaluationResult,
  PolicyPackId,
  PolicyRule,
  PolicySnapshot,
  PolicyVersionRecord,
} from './types.ts';
import { resolvePolicyVersion } from './version.ts';

export type PolicyEngineOptions = {
  readonly registry?: PolicyRegistry;
  readonly reviews?: ManualReviewRegistry;
  readonly events?: PolicyEventSink;
};

/**
 * Deterministic in-process policy engine. Same facts + same version → same
 * result. No generative model participates in the decision.
 */
export class PolicyEngine {
  readonly registry: PolicyRegistry;
  readonly reviews: ManualReviewRegistry;
  private readonly events: PolicyEventSink | undefined;

  constructor(options: PolicyEngineOptions = {}) {
    this.registry = options.registry ?? new PolicyRegistry();
    this.reviews = options.reviews ?? new ManualReviewRegistry();
    this.events = options.events;
  }

  activatePack(packId: PolicyPackId, versionId: string, occurredAt: UtcInstant): void {
    this.registry.activatePack(packId, versionId, occurredAt, this.events);
  }

  retirePack(packId: PolicyPackId, versionId: string, occurredAt: UtcInstant): void {
    this.registry.retirePack(packId, versionId, occurredAt, this.events);
  }

  decideReview(input: ReviewDecisionInput): ReviewDecisionResult {
    const result = this.reviews.decide(input);
    if (result.ok) {
      this.events?.record({
        eventType: 'PolicyReviewDecided',
        schemaVersion: 1,
        occurredAt: input.decidedAt,
        payload: {
          reviewId: result.review.reviewId,
          status: result.review.status,
          decidedByKind: input.decidedBy.kind,
          packId: result.review.snapshot.packId,
          factsHash: result.review.factsHash,
        },
      });
    }
    return result;
  }

  evaluate(intent: ActionIntent, facts: KernelFacts, at: UtcInstant): PolicyEvaluationResult {
    return this.evaluateFacts(policyFactsFromKernel(intent, facts), at);
  }

  evaluateFacts(input: PolicyFactInput, at: UtcInstant): PolicyEvaluationResult {
    const factsHash = hashPolicyFacts(input);
    const resolution = resolveJurisdiction(input);

    if (resolution.status === 'UNRESOLVED') {
      return this.failClosed({
        input,
        at,
        factsHash,
        decision: 'DEFER',
        reasonCodes: ['JURISDICTION_UNRESOLVED'],
        overrideClass: 'REVIEWABLE',
        jurisdiction: input.jurisdiction ?? null,
        packId: null,
      });
    }
    if (resolution.status === 'AMBIGUOUS') {
      return this.failClosed({
        input,
        at,
        factsHash,
        decision: 'REQUIRE_MANUAL_REVIEW',
        reasonCodes: ['JURISDICTION_AMBIGUOUS'],
        overrideClass: 'REVIEWABLE',
        jurisdiction: resolution.candidates.join(','),
        packId: null,
      });
    }

    const pack = this.registry.getPack(resolution.packId);
    if (!pack) {
      return this.failClosed({
        input,
        at,
        factsHash,
        decision: 'DEFER',
        reasonCodes: ['POLICY_PACK_MISSING'],
        overrideClass: 'HARD_BLOCK',
        jurisdiction: resolution.jurisdiction,
        packId: resolution.packId,
      });
    }

    const version = resolvePolicyVersion({
      packId: resolution.packId,
      versions: this.registry.listVersions(resolution.packId),
      at,
      ...(input.policyPin ? { pinVersionId: input.policyPin.versionId } : {}),
    });
    if ('fail' in version) {
      return this.failClosed({
        input,
        at,
        factsHash,
        decision: version.fail === 'POLICY_VERSION_RETIRED' ? 'BLOCK' : 'DEFER',
        reasonCodes: [version.fail],
        overrideClass: 'HARD_BLOCK',
        jurisdiction: resolution.jurisdiction,
        packId: resolution.packId,
      });
    }

    const structural = this.evaluateStructuralGates(input, version);
    if (structural) {
      return this.finish({
        input,
        at,
        factsHash,
        version,
        jurisdiction: resolution.jurisdiction,
        packId: resolution.packId,
        decision: structural.decision,
        reasonCodes: structural.reasonCodes,
        evaluatedRules: [],
        overrideClass: structural.overrideClass,
        legalConfidence: worstLegalConfidence([version.legalReviewStatus]),
      });
    }

    const offeringMode = this.registry.getProductBinding(
      resolveOfferingRefs(input).productId ?? '',
    )?.offeringMode;
    const factMap = toFactMap({
      ...input,
      capabilityEnabled: true,
      capabilityEnvironment: 'simulation',
      ...(offeringMode ? { offeringMode } : {}),
    });

    const evaluated: EvaluatedRule[] = [];
    let combined: DecisionStatus = 'ALLOW';
    const reasonCodes: string[] = ['SIMULATION_STRUCTURAL_PERMIT'];
    let overrideClass: OverrideClass = 'REVIEWABLE';
    const confidences: LegalReviewStatus[] = [version.legalReviewStatus];

    for (const rule of version.rules) {
      if (!ruleApplies(rule, input, at)) {
        continue;
      }
      const predicate = evaluatePredicate(rule.predicate, factMap);
      if (!predicate.ok) {
        return this.finish({
          input,
          at,
          factsHash,
          version,
          jurisdiction: resolution.jurisdiction,
          packId: resolution.packId,
          decision: 'DEFER',
          reasonCodes: ['RULE_EVALUATION_FAILED', 'REQUIRED_FACT_MISSING', rule.reasonCode],
          evaluatedRules: [
            ...evaluated,
            {
              ruleId: rule.ruleId,
              version: rule.version,
              effect: rule.effect,
              reasonCode: rule.reasonCode,
              legalReviewStatus: rule.legalReviewStatus,
              matched: false,
            },
          ],
          overrideClass: 'REVIEWABLE',
          legalConfidence: worstLegalConfidence([...confidences, rule.legalReviewStatus]),
        });
      }
      const grantBlocked =
        rule.effect === 'ALLOW' && rule.legalReviewStatus !== 'CONFIRMED_BY_COUNSEL';
      const matched = predicate.matched && !grantBlocked;
      evaluated.push({
        ruleId: rule.ruleId,
        version: rule.version,
        effect: rule.effect,
        reasonCode: grantBlocked ? 'RESEARCH_REQUIRED_GRANT_IGNORED' : rule.reasonCode,
        legalReviewStatus: rule.legalReviewStatus,
        matched,
      });
      confidences.push(rule.legalReviewStatus);
      if (grantBlocked && predicate.matched) {
        reasonCodes.push('RESEARCH_REQUIRED_GRANT_IGNORED');
        continue;
      }
      if (!matched) {
        continue;
      }
      reasonCodes.push(rule.reasonCode, 'POLICY_RULE_MATCHED');
      if (DECISION_RANK[rule.effect] > DECISION_RANK[combined]) {
        combined = rule.effect;
      }
      if (rule.overrideClass === 'HARD_BLOCK') {
        overrideClass = 'HARD_BLOCK';
      }
    }

    return this.finish({
      input,
      at,
      factsHash,
      version,
      jurisdiction: resolution.jurisdiction,
      packId: resolution.packId,
      decision: combined,
      reasonCodes,
      evaluatedRules: evaluated,
      overrideClass: combined === 'BLOCK' ? overrideClass : combined === 'ALLOW' ? 'REVIEWABLE' : overrideClass,
      legalConfidence: worstLegalConfidence(confidences),
    });
  }

  private evaluateStructuralGates(
    input: PolicyFactInput,
    version: PolicyVersionRecord,
  ): { decision: DecisionStatus; reasonCodes: string[]; overrideClass: OverrideClass } | null {
    if (ENVIRONMENT !== 'simulation') {
      return {
        decision: 'BLOCK',
        reasonCodes: ['LIVE_CAPABILITY_DISABLED'],
        overrideClass: 'HARD_BLOCK',
      };
    }
    if (!input.actor?.id) {
      return {
        decision: 'BLOCK',
        reasonCodes: ['REQUIRED_FACT_MISSING'],
        overrideClass: 'HARD_BLOCK',
      };
    }
    if (!input.customer) {
      return {
        decision: 'DEFER',
        reasonCodes: ['REQUIRED_FACT_MISSING'],
        overrideClass: 'REVIEWABLE',
      };
    }

    const offering = resolveOfferingRefs(input);
    if (!offering.legalEntityId) {
      return {
        decision: 'DEFER',
        reasonCodes: ['REQUIRED_FACT_MISSING'],
        overrideClass: 'REVIEWABLE',
      };
    }
    if (!offering.productId) {
      return {
        decision: 'DEFER',
        reasonCodes: ['PRODUCT_UNSUPPORTED', 'REQUIRED_FACT_MISSING'],
        overrideClass: 'REVIEWABLE',
      };
    }

    const binding = this.registry.getProductBinding(offering.productId);
    if (!binding) {
      return {
        decision: 'DEFER',
        reasonCodes: ['PRODUCT_UNSUPPORTED', 'PRODUCT_CAPABILITY_MISSING'],
        overrideClass: 'HARD_BLOCK',
      };
    }
    if (binding.offeringMode !== 'SIMULATION') {
      return {
        decision: 'BLOCK',
        reasonCodes: ['LIVE_CAPABILITY_DISABLED'],
        overrideClass: 'HARD_BLOCK',
      };
    }
    if (
      binding.supportedJurisdictions.length > 0 &&
      input.jurisdiction &&
      !binding.supportedJurisdictions.includes(input.jurisdiction) &&
      !(offering.productJurisdiction &&
        binding.supportedJurisdictions.includes(offering.productJurisdiction))
    ) {
      return {
        decision: 'DEFER',
        reasonCodes: ['PRODUCT_UNSUPPORTED'],
        overrideClass: 'HARD_BLOCK',
      };
    }

    const capability =
      this.registry.getCapability(binding.requiredCapabilityId) ??
      this.registry.findCapability({
        legalEntityId: offering.legalEntityId,
        actionType: input.actionType,
        productId: offering.productId,
        ...(offering.accountClass ? { productType: offering.accountClass } : {}),
        environment: 'simulation',
      });
    if (!capability) {
      return {
        decision: 'DEFER',
        reasonCodes: ['PRODUCT_CAPABILITY_MISSING', 'LEGAL_ENTITY_CAPABILITY_DISABLED'],
        overrideClass: 'HARD_BLOCK',
      };
    }
    if (!capability.enabled || capability.environment !== 'simulation') {
      return {
        decision: 'BLOCK',
        reasonCodes: ['LEGAL_ENTITY_CAPABILITY_DISABLED'],
        overrideClass: 'HARD_BLOCK',
      };
    }

    const live = this.registry.findCapability({
      legalEntityId: offering.legalEntityId,
      actionType: input.actionType,
      productId: offering.productId,
      ...(offering.accountClass ? { productType: offering.accountClass } : {}),
      environment: 'live',
    });
    if (live?.enabled) {
      return {
        decision: 'BLOCK',
        reasonCodes: ['LIVE_CAPABILITY_DISABLED'],
        overrideClass: 'HARD_BLOCK',
      };
    }

    if (input.customer.status === 'CLOSED' || input.customer.status === 'SUSPENDED') {
      return {
        decision: 'BLOCK',
        reasonCodes: ['CUSTOMER_STATUS_FORBIDDEN'],
        overrideClass: 'HARD_BLOCK',
      };
    }
    if (input.customer.status === 'PROSPECT') {
      return {
        decision: 'BLOCK',
        reasonCodes: ['CUSTOMER_STATUS_FORBIDDEN'],
        overrideClass: 'HARD_BLOCK',
      };
    }
    if (input.customer.status === 'PENDING_VERIFICATION') {
      return {
        decision: 'REQUIRE_MANUAL_REVIEW',
        reasonCodes: ['KYC_FACT_INCOMPLETE'],
        overrideClass: 'REVIEWABLE',
      };
    }

    const kyc = input.identity?.kycState ?? input.customer.verification.kycState;
    if (kyc === undefined || kyc === 'NOT_STARTED' || kyc === 'IN_PROGRESS') {
      return {
        decision: 'DEFER',
        reasonCodes: ['KYC_FACT_INCOMPLETE', 'REQUIRED_FACT_MISSING'],
        overrideClass: 'REVIEWABLE',
      };
    }
    if (kyc === 'FAILED' || kyc === 'EXPIRED') {
      return {
        decision: 'BLOCK',
        reasonCodes: ['KYC_STATE_FORBIDDEN'],
        overrideClass: 'HARD_BLOCK',
      };
    }
    if (input.customer.status !== 'ACTIVE' || kyc !== 'VERIFIED') {
      return {
        decision: 'DEFER',
        reasonCodes: ['KYC_FACT_INCOMPLETE'],
        overrideClass: 'REVIEWABLE',
      };
    }

    if (version.lifecycle === 'DRAFT') {
      return {
        decision: 'DEFER',
        reasonCodes: ['POLICY_VERSION_NOT_EFFECTIVE'],
        overrideClass: 'HARD_BLOCK',
      };
    }
    return null;
  }

  private failClosed(input: {
    readonly input: PolicyFactInput;
    readonly at: UtcInstant;
    readonly factsHash: string;
    readonly decision: DecisionStatus;
    readonly reasonCodes: readonly string[];
    readonly overrideClass: OverrideClass;
    readonly jurisdiction: string | null;
    readonly packId: PolicySnapshot['packId'];
  }): PolicyEvaluationResult {
    return this.finish({
      ...input,
      version: null,
      evaluatedRules: [],
      legalConfidence: 'RESEARCH_REQUIRED',
    });
  }

  private finish(input: {
    readonly input: PolicyFactInput;
    readonly at: UtcInstant;
    readonly factsHash: string;
    readonly version: PolicyVersionRecord | null;
    readonly jurisdiction: string | null;
    readonly packId: PolicySnapshot['packId'];
    readonly decision: DecisionStatus;
    readonly reasonCodes: readonly string[];
    readonly evaluatedRules: readonly EvaluatedRule[];
    readonly overrideClass: OverrideClass;
    readonly legalConfidence: LegalReviewStatus;
  }): PolicyEvaluationResult {
    if (input.version) {
      this.registry.markUsed(input.version.versionId);
    }
    const snapshot: PolicySnapshot = Object.freeze({
      snapshotId: randomUUID(),
      packId: input.packId,
      packVersion: input.version?.version ?? null,
      versionId: input.version?.versionId ?? null,
      packHash: input.version?.contentHash ?? null,
      factsHash: input.factsHash,
      evaluatedRuleIds: Object.freeze(input.evaluatedRules.filter((row) => row.matched).map((row) => row.ruleId)),
      evaluatedRules: Object.freeze([...input.evaluatedRules]),
      decision: input.decision,
      reasonCodes: Object.freeze([...input.reasonCodes]),
      jurisdiction: input.jurisdiction,
      packJurisdiction: input.packId,
      decidedAt: input.at,
      legalConfidence: input.legalConfidence,
      overrideClass: input.overrideClass,
      reviewId: null,
    });

    let reviewId: string | null = null;
    if (input.decision === 'REQUIRE_MANUAL_REVIEW') {
      const review = this.reviews.open({
        reasonCodes: input.reasonCodes,
        snapshot,
        factsHash: input.factsHash,
        overrideClass: input.overrideClass,
        createdAt: input.at,
      });
      reviewId = review.reviewId;
      this.events?.record({
        eventType: 'PolicyReviewRequested',
        schemaVersion: 1,
        occurredAt: input.at,
        payload: {
          reviewId: review.reviewId,
          decision: input.decision,
          packId: input.packId,
          versionId: input.version?.versionId ?? null,
          factsHash: input.factsHash,
        },
      });
    }

    const withReview: PolicySnapshot = reviewId
      ? Object.freeze({ ...snapshot, reviewId })
      : snapshot;

    return Object.freeze({
      decision: input.decision,
      reasonCodes: withReview.reasonCodes,
      evaluatedRules: withReview.evaluatedRules,
      snapshot: withReview,
      reviewRequired: input.decision === 'REQUIRE_MANUAL_REVIEW',
    });
  }
}

function ruleApplies(rule: PolicyRule, input: PolicyFactInput, at: UtcInstant): boolean {
  if (rule.actionTypes.length > 0 && !rule.actionTypes.includes(input.actionType)) {
    return false;
  }
  const offering = resolveOfferingRefs(input);
  if (
    rule.productTypes.length > 0 &&
    offering.accountClass &&
    !rule.productTypes.includes(offering.accountClass)
  ) {
    return false;
  }
  if (rule.legalEntity && offering.legalEntityId && rule.legalEntity !== offering.legalEntityId) {
    return false;
  }
  if (at < rule.effectiveFrom) {
    return false;
  }
  if (rule.effectiveUntil && at >= rule.effectiveUntil) {
    return false;
  }
  return true;
}

function worstLegalConfidence(statuses: readonly LegalReviewStatus[]): LegalReviewStatus {
  const rank: Record<LegalReviewStatus, number> = {
    RESEARCH_REQUIRED: 3,
    DRAFT: 2,
    COUNSEL_REVIEWED: 1,
    CONFIRMED_BY_COUNSEL: 0,
  };
  let worst: LegalReviewStatus = 'CONFIRMED_BY_COUNSEL';
  for (const status of statuses) {
    if (rank[status] > rank[worst]) {
      worst = status;
    }
  }
  return statuses.length === 0 ? 'RESEARCH_REQUIRED' : worst;
}
