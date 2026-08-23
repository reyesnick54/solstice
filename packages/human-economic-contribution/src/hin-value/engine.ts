/**
 * Productized HIN Economic Value Engine.
 *
 * Extends the canonical Human Contribution Registry. Does not mint
 * SunRey Coin, issue Execution Authority, or store raw personal data.
 */

import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { fixtureContribution } from '../fixtures.ts';
import { DEFAULT_VERIFICATION_POLICY_VERSION } from '../fingerprint.ts';
import { subjectRefFor, type ContributionId, type SubjectRef } from '../ids.ts';
import { HumanContributionRegistry } from '../registry.ts';
import type { SourceClass } from '../taxonomy.ts';
import type { RecordContributionInput } from '../types.ts';
import {
  HIN_AI_ROLE,
  aiClassifyCategory,
  aiExplainValueInput,
  aiFlagAnomaly,
  aiSummarizeMetrics,
  refuseAiAuthority,
} from './ai.ts';
import { HinCapLedger, detectQuantitySpike } from './caps.ts';
import {
  canonicalClassFor,
  categoryRequiresConsent,
  categoryRequiresRights,
  isHinProductCategory,
  type HinProductCategory,
} from './categories.ts';
import { customerHinSummary } from './customer.ts';
import { hinReplayKey, isAnonymousSubject } from './duplicate.ts';
import { createHinIssuanceBasisProposal, refuseHinMint } from './issuance-basis.ts';
import { HinValuationMethodologyRegistry } from './methodologies.ts';
import { aggregateHinMetrics } from './metrics.ts';
import {
  hinFailure,
  type HinActor,
  type HinAggregateMetrics,
  type HinAnomalyFlag,
  type HinContributionRecord,
  type HinCustomerSummary,
  type HinDispute,
  type HinDisputeKind,
  type HinEconomicValueInput,
  type HinFailure,
  type HinIssuanceBasisProposal,
  type HinProvenance,
} from './types.ts';
import { computeHinEconomicValueInput } from './value-input.ts';
import { mapRegistryToHinVerification, type HinVerificationState } from './verification.ts';

const FORBIDDEN_ANONYMOUS_SUBJECTS = new Set(
  ['anonymous', 'unknown', 'anon', 'null', 'undefined'].map((seed) => subjectRefFor(seed)),
);

const CATEGORY_SOURCE: Readonly<Record<HinProductCategory, SourceClass>> = Object.freeze({
  KNOWLEDGE: 'VERIFIED_RESEARCH_ATTESTATION',
  SKILL: 'VERIFIED_INSTITUTIONAL_ATTESTATION',
  CREATIVE_OUTPUT: 'VERIFIED_COMMUNITY_ATTESTATION',
  WORK_PRODUCTIVE_ACTIVITY: 'VERIFIED_INSTITUTIONAL_ATTESTATION',
  EDUCATION_LEARNING: 'VERIFIED_INSTITUTIONAL_ATTESTATION',
  COMMUNITY_PARTICIPATION: 'VERIFIED_COMMUNITY_ATTESTATION',
  DATA_CONTRIBUTION: 'HUMAN_INFORMATION_NETWORK',
  ATTENTION_ENGAGEMENT: 'HUMAN_INFORMATION_NETWORK',
  RESEARCH_CONTRIBUTION: 'VERIFIED_RESEARCH_ATTESTATION',
  OTHER_APPROVED_HUMAN_INPUT: 'OTHER_GOVERNED_SOURCE',
});

export type HinSubmitInput = {
  readonly subject: SubjectRef;
  readonly category: HinProductCategory | string;
  readonly sourceReference: string;
  readonly observedAt: UtcInstant;
  readonly createdAt: UtcInstant;
  readonly quantity: bigint;
  readonly qualityBps?: bigint;
  readonly confidenceBps?: bigint;
  readonly purpose?: string;
  readonly jurisdiction?: string;
  readonly consentReference?: string;
  readonly rightsReference?: string;
  readonly usageReceiptReference?: string;
  readonly method?: string;
};

function canVerify(actor: HinActor): Result<true, HinFailure> {
  if (actor.kind === 'FRONTEND') {
    return err(hinFailure('FRONTEND_CANNOT_VERIFY', 'frontend cannot verify a contribution'));
  }
  if (actor.kind === 'AGENT') {
    return err(hinFailure('AGENT_CANNOT_VERIFY', 'agent cannot verify a contribution'));
  }
  if (actor.kind === 'AI') {
    return refuseAiAuthority(actor, 'verify');
  }
  if (actor.kind !== 'AUTHORIZED_VERIFIER' && actor.kind !== 'GOVERNANCE' && actor.kind !== 'AUTHORIZED_SOURCE') {
    return err(hinFailure('UNAUTHORIZED_ACTOR', `${actor.kind} cannot verify contributions`));
  }
  return ok(true);
}

export class HinEconomicValueEngine {
  readonly registry: HumanContributionRegistry;
  readonly methodologies: HinValuationMethodologyRegistry;
  readonly caps: HinCapLedger;
  readonly aiRole = HIN_AI_ROLE;
  private readonly products = new Map<ContributionId, HinContributionRecord>();
  private readonly valueInputs = new Map<string, HinEconomicValueInput>();
  private readonly valueByContribution = new Map<ContributionId, HinEconomicValueInput>();
  private readonly replayKeys = new Map<string, ContributionId>();
  private readonly disputes = new Map<string, HinDispute>();
  private readonly disputed = new Set<ContributionId>();
  private readonly invalidated = new Set<ContributionId>();
  private readonly jurisdictions = new Map<ContributionId, string>();
  private readonly anomalies: HinAnomalyFlag[] = [];
  private readonly categoryById = new Map<ContributionId, HinProductCategory>();

  constructor(
    registry: HumanContributionRegistry = new HumanContributionRegistry(),
    methodologies: HinValuationMethodologyRegistry = new HinValuationMethodologyRegistry(),
  ) {
    this.registry = registry;
    this.methodologies = methodologies;
    this.caps = new HinCapLedger(this.methodologies.active().caps);
  }

  submitFromAuthorizedSource(input: HinSubmitInput, actor: HinActor): Result<HinContributionRecord, HinFailure> {
    if (actor.kind === 'AI') {
      return refuseAiAuthority(actor, 'verify');
    }
    if (actor.kind === 'AGENT') {
      return err(hinFailure('UNAUTHORIZED_ACTOR', 'agent cannot create an authorized HIN contribution'));
    }
    if (actor.kind !== 'AUTHORIZED_SOURCE' && actor.kind !== 'GOVERNANCE' && actor.kind !== 'FRONTEND') {
      return err(hinFailure('UNAUTHORIZED_ACTOR', `${actor.kind} cannot submit contributions`));
    }
    if (!isHinProductCategory(input.category)) {
      return err(hinFailure('CATEGORY_UNKNOWN', `category ${input.category} is not in the HIN category registry`));
    }
    if (isAnonymousSubject(String(input.subject)) || FORBIDDEN_ANONYMOUS_SUBJECTS.has(input.subject)) {
      return err(hinFailure('ANONYMOUS_CONTRIBUTION_FORBIDDEN', 'anonymous fabricated contributions cannot enter verified HIN metrics'));
    }
    if (categoryRequiresConsent(input.category) && !input.consentReference) {
      return err(hinFailure('CONSENT_REQUIRED', `category ${input.category} requires a consent reference`));
    }
    if (categoryRequiresRights(input.category) && !input.rightsReference) {
      return err(hinFailure('RIGHTS_REQUIRED', `category ${input.category} requires an information-rights reference`));
    }
    const replay = hinReplayKey({
      subject: input.subject,
      category: input.category,
      sourceReference: input.sourceReference,
      observedAt: input.observedAt,
    });
    const existingId = this.replayKeys.get(replay);
    if (existingId) {
      return err(hinFailure('REPLAYED_EVENT', `source reference ${input.sourceReference} was already claimed as ${existingId}`));
    }
    const sourceClass: SourceClass = actor.kind === 'FRONTEND' ? 'USER_DECLARED' : CATEGORY_SOURCE[input.category];
    const canonicalClass = canonicalClassFor(input.category);
    const seed = `${input.subject}:${input.sourceReference}:${input.observedAt}`;
    const base = fixtureContribution(canonicalClass, seed);
    const recordInput: RecordContributionInput = {
      ...base,
      subjectRef: input.subject,
      sourceClass,
      measurementQuantity: input.quantity,
      validFrom: input.observedAt,
      jurisdiction: input.jurisdiction ?? 'GB',
      createdAt: input.createdAt,
    };
    const submitted = this.registry.submit(recordInput);
    if (!submitted.ok) {
      if (submitted.error.code === 'DUPLICATE_FINGERPRINT' || submitted.error.code === 'DUPLICATE_ATTEMPT') {
        return err(hinFailure('DUPLICATE_CONTRIBUTION', submitted.error.message));
      }
      if (submitted.error.code === 'CONSENT_REQUIRED' || submitted.error.code === 'INFORMATION_RIGHTS_REQUIRED') {
        return err(hinFailure(submitted.error.code === 'CONSENT_REQUIRED' ? 'CONSENT_REQUIRED' : 'RIGHTS_REQUIRED', submitted.error.message));
      }
      if (submitted.error.code === 'RAW_PERSONAL_DATA_FORBIDDEN' || submitted.error.code === 'PROTECTED_TRAIT_RANKING_FORBIDDEN') {
        return err(
          hinFailure(
            submitted.error.code === 'RAW_PERSONAL_DATA_FORBIDDEN' ? 'RAW_PERSONAL_DATA_FORBIDDEN' : 'PROTECTED_TRAIT_FORBIDDEN',
            submitted.error.message,
          ),
        );
      }
      return err(hinFailure('PROVENANCE_INCOMPLETE', submitted.error.message));
    }
    const product = this.project(submitted.value.contributionId, input.category, input, sourceClass);
    this.replayKeys.set(replay, product.contributionId);
    this.jurisdictions.set(product.contributionId, input.jurisdiction ?? 'GB');
    this.categoryById.set(product.contributionId, input.category);
    const spike = detectQuantitySpike({
      contributionId: product.contributionId,
      quantity: input.quantity,
      typicalQuantity: 1n,
    });
    if (spike) {
      this.anomalies.push(spike);
    }
    return ok(product);
  }

  verify(contributionId: ContributionId, actor: HinActor, at: UtcInstant): Result<HinContributionRecord, HinFailure> {
    const allowed = canVerify(actor);
    if (!allowed.ok) {
      return allowed;
    }
    if (this.disputed.has(contributionId)) {
      return err(hinFailure('ALREADY_DISPUTED', `contribution ${contributionId} is disputed and cannot be verified`));
    }
    const verified = this.registry.verify({
      contributionId,
      verificationTimestamp: at,
      verificationPolicyVersion: DEFAULT_VERIFICATION_POLICY_VERSION,
    });
    if (!verified.ok) {
      return err(hinFailure('PROVENANCE_INCOMPLETE', verified.error.message));
    }
    const category = this.categoryById.get(contributionId);
    if (!category) {
      return err(hinFailure('CONTRIBUTION_NOT_FOUND', `contribution ${contributionId} is not in the HIN product index`));
    }
    const product = this.project(contributionId, category);
    const valued = this.computeValueInput(contributionId, at);
    if (valued.ok) {
      return ok(this.products.get(contributionId) ?? product);
    }
    return ok(product);
  }

  computeValueInput(contributionId: ContributionId, at: UtcInstant): Result<HinEconomicValueInput, HinFailure> {
    const existing = this.valueByContribution.get(contributionId);
    if (existing) {
      return ok(existing);
    }
    const product = this.products.get(contributionId);
    if (!product) {
      return err(hinFailure('CONTRIBUTION_NOT_FOUND', `contribution ${contributionId} is not in the HIN product index`));
    }
    const computed = computeHinEconomicValueInput({
      record: product,
      methodology: this.methodologies.active(at),
      timestamp: at,
    });
    if (!computed.ok) {
      return computed;
    }
    const capped = this.caps.apply(product, computed.value);
    if (!capped.ok) {
      return err(hinFailure('CAP_EXCEEDED', `economic value input exceeds methodology caps for ${product.category}`));
    }
    this.valueInputs.set(computed.value.valueInputId, computed.value);
    this.valueByContribution.set(contributionId, computed.value);
    this.project(contributionId, product.category);
    return ok(computed.value);
  }

  challenge(
    input: { readonly contributionId: ContributionId; readonly kind: HinDisputeKind; readonly reasonCode: string; readonly at: UtcInstant },
    actor: HinActor,
  ): Result<HinDispute, HinFailure> {
    if (actor.kind === 'AI') {
      return refuseAiAuthority(actor, 'verify');
    }
    const product = this.products.get(input.contributionId);
    if (!product) {
      return err(hinFailure('CONTRIBUTION_NOT_FOUND', `contribution ${input.contributionId} is not in the HIN product index`));
    }
    const disputeId = `hdisp_${input.contributionId}_${input.kind}`;
    const dispute: HinDispute = Object.freeze({
      disputeId,
      contributionId: input.contributionId,
      kind: input.kind,
      state: 'OPEN',
      openedAt: input.at,
      openedBy: actor.actorId,
      reasonCode: input.reasonCode,
      resolvedAt: null,
      historicalEvidencePreserved: true,
    });
    this.disputes.set(disputeId, dispute);
    this.disputed.add(input.contributionId);
    this.valueByContribution.delete(input.contributionId);
    this.project(input.contributionId, product.category);
    return ok(dispute);
  }

  resolveDispute(
    input: { readonly disputeId: string; readonly outcome: 'UPHELD' | 'REJECTED' | 'CORRECTED'; readonly at: UtcInstant },
    actor: HinActor,
  ): Result<HinDispute, HinFailure> {
    if (actor.kind !== 'GOVERNANCE' && actor.kind !== 'AUTHORIZED_VERIFIER') {
      return err(hinFailure('UNAUTHORIZED_ACTOR', `${actor.kind} cannot resolve a contribution dispute`));
    }
    const current = this.disputes.get(input.disputeId);
    if (!current) {
      return err(hinFailure('NOT_DISPUTED', `dispute ${input.disputeId} was not opened`));
    }
    const next: HinDispute = Object.freeze({
      ...current,
      state: input.outcome,
      resolvedAt: input.at,
      historicalEvidencePreserved: true,
    });
    this.disputes.set(input.disputeId, next);
    if (input.outcome === 'UPHELD' || input.outcome === 'CORRECTED') {
      this.invalidated.add(current.contributionId);
      this.disputed.delete(current.contributionId);
      this.valueByContribution.delete(current.contributionId);
    } else {
      this.disputed.delete(current.contributionId);
    }
    const category = this.categoryById.get(current.contributionId);
    if (category) {
      this.project(current.contributionId, category);
    }
    return ok(next);
  }

  proposeIssuanceBasis(contributionId: ContributionId): Result<HinIssuanceBasisProposal, HinFailure> {
    const value = this.valueByContribution.get(contributionId);
    if (!value) {
      return err(hinFailure('VALUE_INPUT_INELIGIBLE', `contribution ${contributionId} has no economic value input`));
    }
    return createHinIssuanceBasisProposal(value);
  }

  authorizeMint(): Result<never, HinFailure> {
    return refuseHinMint();
  }

  get(contributionId: ContributionId): HinContributionRecord | undefined {
    return this.products.get(contributionId);
  }

  list(subject?: SubjectRef): readonly HinContributionRecord[] {
    const rows = [...this.products.values()];
    return Object.freeze(subject ? rows.filter((row) => row.subject === subject) : rows);
  }

  metrics(): HinAggregateMetrics {
    return aggregateHinMetrics({
      records: [...this.products.values()],
      valueInputs: [...this.valueInputs.values()],
      jurisdictions: Object.fromEntries(this.jurisdictions),
    });
  }

  customerSummary(subject: SubjectRef): HinCustomerSummary {
    return customerHinSummary({
      subject,
      records: [...this.products.values()],
      valueInputs: [...this.valueInputs.values()],
    });
  }

  publicMethodologies() {
    return this.methodologies.listPublicMetadata();
  }

  classify(proposedCategory: string) {
    return aiClassifyCategory({ proposedCategory });
  }

  explain(contributionId: ContributionId) {
    const value = this.valueByContribution.get(contributionId);
    return value ? aiExplainValueInput(value) : null;
  }

  summarize() {
    return aiSummarizeMetrics(this.metrics());
  }

  flagAnomaly(contributionId: ContributionId) {
    const product = this.products.get(contributionId);
    return product ? aiFlagAnomaly(product) : null;
  }

  anomalyFlags(): readonly HinAnomalyFlag[] {
    return Object.freeze([...this.anomalies]);
  }

  disputesFor(contributionId: ContributionId): readonly HinDispute[] {
    return Object.freeze([...this.disputes.values()].filter((row) => row.contributionId === contributionId));
  }

  private project(contributionId: ContributionId, category: HinProductCategory, submit?: HinSubmitInput, sourceClass?: SourceClass): HinContributionRecord {
    const record = this.registry.getRecord(contributionId);
    if (!record) {
      throw new Error(`registry record ${contributionId} missing during projection`);
    }
    const verification: HinVerificationState = mapRegistryToHinVerification({
      status: record.status,
      sourceClass: record.sourceClass,
      verificationQuality: record.event.verificationQuality,
      disputed: this.disputed.has(contributionId),
      invalidated: this.invalidated.has(contributionId),
    });
    const provenance: HinProvenance = Object.freeze({
      source: record.sourceClass,
      method: submit?.method ?? 'AUTHORIZED_SOURCE_OBSERVATION',
      observedAt: submit?.observedAt ?? record.measurementPeriod.start,
      rightsReference: record.rightsReferences[0] ?? null,
      consentReference: record.consentReferences[0] ?? null,
      verificationReference: record.verificationPolicyVersion,
      integrityDigest: record.evidenceDigest,
    });
    const prior = this.products.get(contributionId);
    const product: HinContributionRecord = Object.freeze({
      schemaVersion: 1,
      contributionId: record.contributionId,
      subject: record.subjectRef,
      category,
      canonicalClass: record.contributionClass,
      source: sourceClass ?? record.sourceClass,
      sourceReference: submit?.sourceReference ?? prior?.sourceReference ?? record.event.eventReference,
      verification,
      provenance,
      rightsReference: record.rightsReferences[0] ?? null,
      purpose: record.purposeReferences[0] ?? null,
      observedAt: submit?.observedAt ?? prior?.observedAt ?? record.measurementPeriod.start,
      quantity: record.event.measurement.quantity,
      unit: record.measurementUnit,
      qualityBps: submit?.qualityBps ?? prior?.qualityBps ?? 8_000n,
      confidenceBps: submit?.confidenceBps ?? prior?.confidenceBps ?? 8_000n,
      status: verification,
      valuationPolicyVersion: this.valueByContribution.get(contributionId)?.methodologyVersion ?? null,
      economicValueInputId: this.valueByContribution.get(contributionId)?.valueInputId ?? null,
      evidenceDigest: record.evidenceDigest,
      containsRawPersonalData: false,
      sunReyQuantity: null,
      mintRequested: false,
      issuancePromised: false,
    });
    this.products.set(contributionId, product);
    return product;
  }
}

export function createHinEconomicValueEngine(): HinEconomicValueEngine {
  return new HinEconomicValueEngine();
}
