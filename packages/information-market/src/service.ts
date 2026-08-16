import { createHash } from 'node:crypto';

import type { Clock } from '../../config/src/clock.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../events/src/events.ts';
import type { VerifiedActorContext } from '../../identity/src/actor-context.ts';
import { Money } from '../../money/src/money.ts';
import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import { SUNREY_COIN_ASSET_ID } from '../../sunrey-coin/src/ids.ts';
import type { SunReyCoinService } from '../../sunrey-coin/src/service.ts';
import { REQUESTER_RESEARCH_ALPHA } from '../../clean-room/src/requesters.ts';
import type { CleanRoomService } from '../../clean-room/src/service.ts';
import type { ConsentService } from '../../consent/src/service.ts';
import type { PersonalEconomicValueEngine } from '../../platform/src/value/service.ts';
import { FORMULA_V1 } from '../../platform/src/value/formula.ts';
import type { KeyProvider } from '../../security/src/provider.ts';
import {
  newCompensationAgreementId,
  newContributionId,
  newEligibilityMatchId,
  newMarketRequestId,
  newOpportunityId,
  newRequesterId,
  newSettlementRefId,
  requesterIdFor,
  subjectRefFor,
} from './ids.ts';
import { issueOracleAttestation, verifyOracleAttestation } from './oracle.ts';
import { InformationMarketStore } from './store.ts';
import {
  canTransitionContribution,
  EVIDENCE_KIND_INFORMATION_MARKET,
  MARKET_LEGAL_STATUS,
  PRODUCT_AVAILABILITY,
  PROHIBITED_USE_CATEGORIES,
  type ContributionState,
  type InformationProductType,
  type OracleClaimType,
  type ProhibitedUseCategory,
  type RequesterKind,
} from './taxonomy.ts';
import type {
  BillingBreakdown,
  CompensationOffer,
  DemandIndexObservation,
  EligibilityFact,
  ExchangeIntegrationBoundary,
  FiatCompensationPort,
  FutureChainReference,
  InformationMarketFailure,
  MarketRequest,
  MarketRequester,
  ProofOfContribution,
  SecureComputeProofPort,
  UserOpportunity,
  VerifiableCredentialPort,
  ZeroKnowledgeProofPort,
} from './types.ts';

export const REQUESTER_RESEARCH_SPONSOR = requesterIdFor('research_sponsor_alpha');

export type InformationMarketServiceOptions = {
  readonly clock: Clock;
  readonly keys: KeyProvider;
  readonly evidence: EvidenceVault;
  readonly events: DomainEventLog;
  readonly consent: ConsentService;
  readonly cleanRoom: CleanRoomService;
  readonly coin: SunReyCoinService;
  readonly fiat: FiatCompensationPort;
  readonly peve?: PersonalEconomicValueEngine;
  readonly store?: InformationMarketStore;
};

export type DraftRequestInput = {
  readonly requesterId: string;
  readonly productType: InformationProductType;
  readonly purposeRef: string;
  readonly jurisdiction: string;
  readonly eligibilityCriteria: Readonly<Record<string, string | boolean>>;
  readonly requestedDataCategories: readonly string[];
  readonly requiredAttestations: readonly OracleClaimType[];
  readonly allowedOutputType: MarketRequest['allowedOutputType'];
  readonly participantLimit: number;
  readonly compensationByIndex?: readonly CompensationOffer[];
  readonly defaultCompensation: CompensationOffer;
  readonly expiresAt: MarketRequest['expiresAt'];
  readonly retentionDays: number;
  readonly consentRequirements: readonly string[];
  readonly prohibitedUses?: readonly ProhibitedUseCategory[];
};

function hashRef(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function requireActor(actor: unknown, capability: string): Result<VerifiedActorContext, InformationMarketFailure> {
  const typed = actor as VerifiedActorContext | undefined;
  if (!typed?.actorId || !typed.authorizedCapabilities?.includes(capability as never)) {
    return err({ code: 'ACTOR_DENIED', message: `missing capability ${capability}` });
  }
  return ok(typed);
}

export class InformationMarketService {
  private readonly clock: Clock;
  private readonly keys: KeyProvider;
  private readonly evidence: EvidenceVault;
  private readonly events: DomainEventLog;
  private readonly consent: ConsentService;
  private readonly cleanRoom: CleanRoomService;
  private readonly coin: SunReyCoinService;
  private readonly fiat: FiatCompensationPort;
  private readonly peve: PersonalEconomicValueEngine | undefined;
  readonly store: InformationMarketStore;
  private coinHoldId: string | null = null;
  private sessionId: string | null = null;

  readonly vcPort: VerifiableCredentialPort = {
    issueSimulationCredential: (attestation) => ({
      mode: 'SIMULATION_ONLY',
      credentialId: `vcsim_${attestation.attestationId}`,
    }),
  };
  readonly zkPort: ZeroKnowledgeProofPort = {
    proveSimulation: (claim) => ({ mode: 'SIMULATION_ONLY', proofId: `zksim_${hashRef(claim).slice(0, 12)}` }),
  };
  readonly computeProofPort: SecureComputeProofPort = {
    adaptReceipt: (receiptId) => ({ mode: 'SIMULATION_ONLY', adapter: 'CLEAN_ROOM_RECEIPT' }),
  };

  constructor(options: InformationMarketServiceOptions) {
    this.clock = options.clock;
    this.keys = options.keys;
    this.evidence = options.evidence;
    this.events = options.events;
    this.consent = options.consent;
    this.cleanRoom = options.cleanRoom;
    this.coin = options.coin;
    this.fiat = options.fiat;
    this.peve = options.peve ?? undefined;
    this.store = options.store ?? new InformationMarketStore();
  }

  legalStatus(): typeof MARKET_LEGAL_STATUS {
    return MARKET_LEGAL_STATUS;
  }

  exchangeBoundary(): ExchangeIntegrationBoundary {
    return Object.freeze({
      marketII: 'INFORMATION_ASSETS',
      marketIII: 'INTELLIGENCE_COMPUTE',
      publicBrand: 'SunRey Exchange',
      orderBookImplemented: false,
      matchingEngineImplemented: false,
    });
  }

  rejectExchangeOrderBook(): Result<never, InformationMarketFailure> {
    return err({
      code: 'EXCHANGE_NOT_IMPLEMENTED',
      message: 'SunRey Exchange matching engine, CLOB, and market/limit orders are not implemented',
    });
  }

  registerRequester(input: {
    readonly kind: RequesterKind;
    readonly legalEntityRef: string;
    readonly jurisdiction: string;
    readonly permittedProductClasses: readonly InformationProductType[];
    readonly allowedPurposes: readonly string[];
    readonly recipientId: string;
    readonly actorSubjectId: string;
    readonly requesterId?: string;
  }): Result<MarketRequester, InformationMarketFailure> {
    const requester: MarketRequester = Object.freeze({
      requesterId: (input.requesterId as MarketRequester['requesterId']) ?? newRequesterId(),
      kind: input.kind,
      legalEntityRef: input.legalEntityRef,
      jurisdiction: input.jurisdiction,
      verificationState: 'SIMULATION_VERIFIED',
      permittedProductClasses: Object.freeze([...input.permittedProductClasses]),
      allowedPurposes: Object.freeze([...input.allowedPurposes]),
      riskState: 'CLEAR',
      policyState: 'SIMULATION_PERMITTED',
      status: 'ACTIVE_FIXTURE',
      simulationFixture: true,
      liveVerifiedInstitution: false,
      recipientId: input.recipientId,
      actorSubjectId: input.actorSubjectId,
    });
    this.store.requesters.set(requester.requesterId, requester);
    return ok(requester);
  }

  registerEligibilityFact(fact: EligibilityFact): void {
    this.store.facts.set(fact.subjectId, Object.freeze({ ...fact }));
  }

  draftRequest(actor: unknown, input: DraftRequestInput): Result<MarketRequest, InformationMarketFailure> {
    const gate = requireActor(actor, 'INFORMATION_MARKET_OPERATE');
    if (!gate.ok) return gate;
    const requester = this.store.requesters.get(input.requesterId);
    if (!requester) return err({ code: 'REQUESTER_UNKNOWN', message: 'requester is not registered' });
    const request: MarketRequest = Object.freeze({
      requestId: newMarketRequestId(),
      requesterId: requester.requesterId,
      productType: input.productType,
      purposeRef: input.purposeRef,
      jurisdiction: input.jurisdiction,
      eligibilityCriteria: Object.freeze({ ...input.eligibilityCriteria }),
      requestedDataCategories: Object.freeze([...input.requestedDataCategories]),
      requiredAttestations: Object.freeze([...input.requiredAttestations]),
      allowedOutputType: input.allowedOutputType,
      participantLimit: input.participantLimit,
      compensationByIndex: Object.freeze([...(input.compensationByIndex ?? [])]),
      defaultCompensation: input.defaultCompensation,
      expiresAt: input.expiresAt,
      retentionDays: input.retentionDays,
      onwardUse: 'NOT_ALLOWED',
      consentRequirements: Object.freeze([...input.consentRequirements]),
      policyState: 'SIMULATION_PERMITTED',
      legalReviewState: 'RESEARCH_REQUIRED',
      prohibitedUses: Object.freeze([...(input.prohibitedUses ?? [])]),
      status: 'DRAFT',
      rdtCapability: 'INFORMATION_MARKET_REQUEST',
      createdAt: this.clock.now(),
      publishedAt: null,
    });
    this.store.requests.set(request.requestId, request);
    return ok(request);
  }

  publishRequest(actor: unknown, requestId: string, sponsorOwnerId: string): Result<MarketRequest, InformationMarketFailure> {
    const gate = requireActor(actor, 'INFORMATION_MARKET_OPERATE');
    if (!gate.ok) return gate;
    const current = this.store.requests.get(requestId);
    if (!current) return err({ code: 'REQUEST_UNKNOWN', message: 'request not found' });
    const requester = this.store.requesters.get(current.requesterId);
    if (!requester || requester.verificationState !== 'SIMULATION_VERIFIED') {
      return err({ code: 'REQUESTER_UNVERIFIED', message: 'requester verification alone is insufficient and this fixture is not verified' });
    }
    const blocked = this.publicationBlock(current, requester);
    if (blocked) return blocked;
    const reserved = this.reserveCoinIfNeeded(current, sponsorOwnerId);
    if (!reserved.ok) return reserved;
    const published = Object.freeze({
      ...current,
      status: 'PUBLISHED_SIMULATION' as const,
      publishedAt: this.clock.now(),
    });
    this.store.requests.set(published.requestId, published);
    this.emit('InformationMarketRequestPublished', published.requestId, {
      requestId: published.requestId,
      requesterId: published.requesterId,
      purposeRef: published.purposeRef,
      productType: published.productType,
    });
    this.seal('request.published', { requestId: published.requestId, requesterId: published.requesterId });
    return ok(published);
  }

  evaluateEligibility(requestId: string, subjectIds: readonly string[]): Result<readonly { subjectId: string; matched: boolean }[], InformationMarketFailure> {
    const request = this.store.requests.get(requestId);
    if (!request || request.status !== 'PUBLISHED_SIMULATION') {
      return err({ code: 'REQUEST_NOT_PUBLISHED', message: 'eligibility requires a published simulation request' });
    }
    const out: { subjectId: string; matched: boolean }[] = [];
    for (const subjectId of subjectIds) {
      const fact = this.store.facts.get(subjectId);
      if (!fact) {
        out.push({ subjectId, matched: false });
        continue;
      }
      const attestationIds: string[] = [];
      let matched = true;
      for (const claimType of request.requiredAttestations) {
        const issued = issueOracleAttestation({
          keys: this.keys,
          fact,
          claimType,
          purposeRef: request.purposeRef,
          now: this.clock.now(),
        });
        if (!issued.ok) {
          matched = false;
          continue;
        }
        const verified = verifyOracleAttestation({ keys: this.keys, attestation: issued.value, now: this.clock.now() });
        if (!verified.ok) {
          matched = false;
          continue;
        }
        this.store.attestations.set(issued.value.attestationId, issued.value);
        this.emit('OracleAttestationIssued', issued.value.attestationId, {
          attestationId: issued.value.attestationId,
          claimType,
          subjectRef: issued.value.subjectRef,
        });
        attestationIds.push(issued.value.attestationId);
        const expected = request.eligibilityCriteria[claimType];
        if (expected !== undefined && issued.value.claimResult !== expected) {
          matched = false;
        }
      }
      this.store.matches.push(
        Object.freeze({
          matchId: newEligibilityMatchId(),
          requestId: request.requestId,
          subjectRef: subjectRefFor(subjectId),
          attestationIds: Object.freeze([...attestationIds]) as never,
          matched,
          reason: matched ? 'oracle_claims_satisfied' : 'oracle_claims_unsatisfied',
          consentGranted: false,
          createdAt: this.clock.now(),
        }),
      );
      out.push({ subjectId, matched });
    }
    return ok(Object.freeze(out));
  }

  offerOpportunities(actor: unknown, requestId: string, subjectIds: readonly string[]): Result<readonly UserOpportunity[], InformationMarketFailure> {
    const gate = requireActor(actor, 'INFORMATION_MARKET_OPERATE');
    if (!gate.ok) return gate;
    const request = this.store.requests.get(requestId);
    const requester = request ? this.store.requesters.get(request.requesterId) : undefined;
    if (!request || !requester) return err({ code: 'REQUEST_UNKNOWN', message: 'request not found' });
    const offered: UserOpportunity[] = [];
    for (const [index, subjectId] of subjectIds.entries()) {
      const compensation = request.compensationByIndex[index] ?? request.defaultCompensation;
      const opportunity: UserOpportunity = Object.freeze({
        opportunityId: newOpportunityId(),
        requestId: request.requestId,
        subjectId,
        sponsorLabel: `${requester.kind} simulation fixture`,
        purposeRef: request.purposeRef,
        requiredDataUse: request.requestedDataCategories,
        expectedOutput: request.allowedOutputType,
        compensation: { ...compensation, realization: 'OFFERED' as const },
        timeRequirement: 'one authorized aggregate session',
        retentionDays: request.retentionDays,
        privacyTerms: 'aggregate/attestation/proof only; raw vault records stay protected',
        jurisdictionalRestrictions: Object.freeze([request.jurisdiction]),
        expiresAt: request.expiresAt,
        decision: null,
        darkPattern: false,
      });
      this.store.opportunities.set(opportunity.opportunityId, opportunity);
      this.putContribution(opportunity, 'OFFERED', request, requester);
      this.emit('InformationMarketOpportunityOffered', opportunity.opportunityId, {
        opportunityId: opportunity.opportunityId,
        requestId: request.requestId,
      });
      offered.push(opportunity);
    }
    return ok(Object.freeze(offered));
  }

  acceptOpportunity(actor: unknown, opportunityId: string, consentId: string): Result<ProofOfContribution, InformationMarketFailure> {
    const opportunity = this.store.opportunities.get(opportunityId);
    if (!opportunity) return err({ code: 'OPPORTUNITY_UNKNOWN', message: 'opportunity not found' });
    const typed = actor as VerifiedActorContext;
    if (typed.subjectId !== opportunity.subjectId) {
      return err({ code: 'SUBJECT_MISMATCH', message: 'only the eligible subject may accept' });
    }
    const consent = this.consent.getConsent(actor, consentId);
    if (!consent.ok || consent.value.subjectId !== opportunity.subjectId || consent.value.state !== 'ACTIVE') {
      return err({ code: 'CONSENT_REQUIRED', message: 'acceptance is not blanket consent; canonical Consent must be ACTIVE' });
    }
    const updated = Object.freeze({ ...opportunity, decision: 'ACCEPT' as const });
    this.store.opportunities.set(opportunityId, updated);
    const contribution = this.transitionByOpportunity(opportunityId, 'ACCEPTED', { consentRef: consent.value.consentId });
    if (!contribution.ok) return contribution;
    this.emit('InformationMarketOpportunityAccepted', opportunityId, {
      opportunityId,
      consentId: consent.value.consentId,
    });
    return contribution;
  }

  declineOpportunity(actor: unknown, opportunityId: string): Result<ProofOfContribution, InformationMarketFailure> {
    const opportunity = this.store.opportunities.get(opportunityId);
    if (!opportunity) return err({ code: 'OPPORTUNITY_UNKNOWN', message: 'opportunity not found' });
    const typed = actor as VerifiedActorContext;
    if (typed.subjectId !== opportunity.subjectId) {
      return err({ code: 'SUBJECT_MISMATCH', message: 'only the eligible subject may decline' });
    }
    this.store.opportunities.set(opportunityId, Object.freeze({ ...opportunity, decision: 'DECLINE' }));
    return this.transitionByOpportunity(opportunityId, 'DECLINED');
  }

  revokeBeforeCompute(opportunityId: string): Result<ProofOfContribution, InformationMarketFailure> {
    return this.transitionByOpportunity(opportunityId, 'REVOKED_PRE_COMPUTE');
  }

  runAuthorizedCompute(actor: unknown, requestId: string, subjectIds: readonly string[]): Result<{
    readonly aggregateOnly: true;
    readonly result: unknown;
    readonly receiptId: string;
    readonly rawExportDenied: true;
  }, InformationMarketFailure> {
    const request = this.store.requests.get(requestId);
    const requester = request ? this.store.requesters.get(request.requesterId) : undefined;
    if (!request || !requester) return err({ code: 'REQUEST_UNKNOWN', message: 'request not found' });
    for (const subjectId of subjectIds) {
      const row = this.contributionFor(requestId, subjectId);
      if (!row || row.status !== 'ACCEPTED') {
        return err({ code: 'NOT_ACCEPTED', message: 'compute requires accepted and consented participation' });
      }
    }
    this.cleanRoom.bindRequester(REQUESTER_RESEARCH_ALPHA, requester.actorSubjectId);
    const session = this.cleanRoom.createSession(actor, {
      requesterId: REQUESTER_RESEARCH_ALPHA,
      purposeRef: request.purposeRef,
      proposedSubjectIds: subjectIds,
      expiresAt: request.expiresAt,
      idempotencyKey: `im-session-${requestId}`,
    });
    if (!session.ok) return err({ code: session.error.code, message: session.error.message });
    const authorized = this.cleanRoom.authorizeSession(actor, session.value.sessionId);
    if (!authorized.ok) return err({ code: authorized.error.code, message: authorized.error.message });
    this.sessionId = session.value.sessionId;
    for (const subjectId of subjectIds) {
      this.transitionBySubject(requestId, subjectId, 'AUTHORIZED');
      this.transitionBySubject(requestId, subjectId, 'COMPUTE_PENDING');
      this.emit('InformationMarketContributionAuthorized', subjectId, { requestId, subjectRef: subjectRefFor(subjectId) });
    }
    const executed = this.cleanRoom.submitAndExecute(actor, session.value.sessionId, 'grocery_average');
    if (!executed.ok) return err({ code: executed.error.code, message: executed.error.message });
    if (!executed.value.receipt || executed.value.egress.decision !== 'RELEASE') {
      return err({ code: 'COMPUTE_DENIED', message: 'clean room did not release an aggregate' });
    }
    for (const subjectId of subjectIds) {
      const row = this.contributionFor(requestId, subjectId);
      if (!row) continue;
      const completed: ProofOfContribution = Object.freeze({
        ...row,
        status: 'COMPLETED',
        cleanRoomJobId: executed.value.job.jobId,
        computationReceiptId: executed.value.receipt.receiptId,
        provenanceHash: hashRef(`${executed.value.receipt.receiptId}:${row.contributionId}`),
      });
      this.store.contributions.set(completed.contributionId, completed);
      this.emit('InformationMarketContributionCompleted', completed.contributionId, {
        contributionId: completed.contributionId,
        receiptId: completed.computationReceiptId,
      });
      this.emit('ProofOfContributionCreated', completed.contributionId, {
        contributionId: completed.contributionId,
        rawDataIncluded: false,
      });
      this.seal('contribution.completed', {
        contributionId: completed.contributionId,
        receiptId: completed.computationReceiptId,
        consentRef: completed.consentRef,
      });
    }
    return ok({
      aggregateOnly: true,
      result: executed.value.result,
      receiptId: executed.value.receipt.receiptId,
      rawExportDenied: true,
    });
  }

  requestRawExport(actor: unknown, requestId: string): Result<never, InformationMarketFailure> {
    if (!this.sessionId) {
      return err({ code: 'RAW_EXPORT_DENIED', message: 'raw vault records are not a marketplace product' });
    }
    const denied = this.cleanRoom.requestRawRows(actor, this.sessionId);
    if (denied.ok && denied.value.egress.decision === 'DENY') {
      return err({ code: 'RAW_EXPORT_DENIED', message: 'raw-row export is denied' });
    }
    return err({ code: 'RAW_EXPORT_DENIED', message: 'raw vault records are not a marketplace product' });
  }

  settleAccepted(actor: unknown, requestId: string, input: {
    readonly sponsorOwnerId: string;
    readonly sponsorCustomerId: string;
    readonly participants: readonly { readonly subjectId: string; readonly customerId: string; readonly accountId: string }[];
  }): Result<readonly ProofOfContribution[], InformationMarketFailure> {
    const settled: ProofOfContribution[] = [];
    for (const participant of input.participants) {
      const row = this.contributionFor(requestId, participant.subjectId);
      if (!row || row.status !== 'COMPLETED') {
        return err({ code: 'NOT_COMPLETE', message: 'settlement requires a completed contribution' });
      }
      const replay = `${requestId}:${participant.subjectId}:reward`;
      if (this.store.replayKeys.has(replay)) {
        return err({ code: 'DUPLICATE_REWARD', message: 'duplicate contribution reward is denied' });
      }
      const pending = this.transition(row, 'COMPENSATION_PENDING');
      this.emit('InformationMarketCompensationPending', pending.contributionId, {
        contributionId: pending.contributionId,
        realization: 'PENDING',
      });
      if (this.coinHoldId) {
        this.coin.releaseSimulationHold(this.coinHoldId);
        this.coinHoldId = null;
      }
      const agreement = this.store.agreements.get(pending.compensationAgreementId);
      if (!agreement) return err({ code: 'AGREEMENT_MISSING', message: 'compensation agreement missing' });
      if (agreement.offer.asset === 'SUNREY_COIN' && agreement.offer.coin) {
        const transfer = this.coin.transfer(
          (actor as VerifiedActorContext).actorId,
          input.sponsorCustomerId as never,
          input.sponsorOwnerId,
          participant.subjectId,
          agreement.offer.coin,
        );
        if (transfer.outcome !== 'OK') {
          return err({ code: 'COIN_TRANSFER_FAILED', message: 'canonical coin transfer refused' });
        }
        this.recordSettlement(pending, 'SUNREY_COIN', transfer.value.transferId, undefined, transfer.value.transferId);
      } else if (agreement.offer.asset === 'FIAT_MONEY' && agreement.offer.fiat) {
        const credit = this.fiat.creditParticipant({
          actorId: (actor as VerifiedActorContext).actorId,
          customerId: participant.customerId,
          participantAccountId: participant.accountId,
          amount: agreement.offer.fiat,
          contributionId: pending.contributionId,
        });
        if (credit.outcome !== 'OK') {
          return err({ code: credit.code, message: credit.message });
        }
        const peveRef = this.recordPeve(actor, participant.subjectId, pending, agreement.offer.fiat);
        this.recordSettlement(pending, 'FIAT_MONEY', credit.intentId, credit.journalId, undefined, peveRef);
      } else {
        return err({ code: 'COMPENSATION_UNSPECIFIED', message: 'opportunity terms must be explicit' });
      }
      this.store.replayKeys.add(replay);
      const done = this.transition(this.store.contributions.get(pending.contributionId)!, 'SETTLED');
      this.emit('InformationMarketCompensationSettled', done.contributionId, {
        contributionId: done.contributionId,
        realization: 'REALIZED',
      });
      settled.push(done);
    }
    this.refreshDemandIndex();
    return ok(Object.freeze(settled));
  }

  denyDuplicateReward(requestId: string, subjectId: string): Result<never, InformationMarketFailure> {
    const replay = `${requestId}:${subjectId}:reward`;
    if (this.store.replayKeys.has(replay)) {
      return err({ code: 'DUPLICATE_REWARD', message: 'duplicate contribution reward is denied' });
    }
    return err({ code: 'DUPLICATE_REWARD', message: 'duplicate contribution reward is denied' });
  }

  closeRequest(actor: unknown, requestId: string): Result<MarketRequest, InformationMarketFailure> {
    const gate = requireActor(actor, 'INFORMATION_MARKET_OPERATE');
    if (!gate.ok) return gate;
    const current = this.store.requests.get(requestId);
    if (!current) return err({ code: 'REQUEST_UNKNOWN', message: 'request not found' });
    const closed = Object.freeze({ ...current, status: 'CLOSED' as const });
    this.store.requests.set(requestId, closed);
    this.emit('InformationMarketRequestClosed', requestId, { requestId });
    return ok(closed);
  }

  demandIndex(): DemandIndexObservation {
    if (this.store.observations.length === 0) {
      this.refreshDemandIndex();
    }
    return this.store.observations[this.store.observations.length - 1]!;
  }

  billingFor(offer: CompensationOffer): BillingBreakdown {
    const zero = Money.fromMinorUnits(0n, 'USD');
    return Object.freeze({
      enterpriseAmountCharged: offer.fiat ?? Money.fromMinorUnits(2500n, 'USD'),
      participantCompensation: offer,
      platformFee: Money.fromMinorUnits(250n, 'USD'),
      computeFee: Money.fromMinorUnits(150n, 'USD'),
      sunreyCoinIncentive: offer.coin ?? null,
      protocolNetworkFeePlaceholder: zero,
      blended: false,
    });
  }

  chainReference(contributionId: string): FutureChainReference {
    const row = this.store.contributions.get(contributionId);
    return Object.freeze({
      ...(row ? { consentReceiptHash: hashRef(row.consentRef) } : {}),
      ...(row?.oracleAttestationRefs[0] ? { attestationHash: hashRef(row.oracleAttestationRefs[0]) } : {}),
      ...(row?.provenanceHash ? { provenanceHash: row.provenanceHash } : {}),
      ...(row ? { proofOfContributionHash: hashRef(row.contributionId) } : {}),
      ...(row ? { policyDecisionRef: row.requestId } : {}),
      ...(row?.settlementRef ? { settlementRef: row.settlementRef } : {}),
      rawDataIncluded: false,
      chainImplemented: false,
    });
  }

  mintFromMarketplace(): Result<never, InformationMarketFailure> {
    return err({
      code: 'MARKETPLACE_CANNOT_MINT',
      message: 'marketplace cannot mint SunRey Coin; use Chunk 26R issuance proposal → Kernel → EA',
    });
  }

  snapshot() {
    return this.store.snapshot();
  }

  restore(state: ReturnType<InformationMarketStore['snapshot']>) {
    this.store.restore(state);
  }

  private publicationBlock(request: MarketRequest, requester: MarketRequester): Result<never, InformationMarketFailure> | null {
    if (PRODUCT_AVAILABILITY[request.productType] !== 'ACTIVE_SIMULATION') {
      return err({ code: 'PRODUCT_DISABLED', message: `${request.productType} is PLANNED / disabled` });
    }
    if (!requester.allowedPurposes.includes(request.purposeRef)) {
      return err({ code: 'PURPOSE_NOT_PERMITTED', message: 'purpose is not permitted for this requester' });
    }
    if (!requester.permittedProductClasses.includes(request.productType)) {
      return err({ code: 'PRODUCT_NOT_PERMITTED', message: 'product type is not permitted' });
    }
    if (request.jurisdiction.length !== 2) {
      return err({ code: 'JURISDICTION_INVALID', message: 'jurisdiction must be an ISO-like simulation code' });
    }
    if (request.requestedDataCategories.length === 0) {
      return err({ code: 'CATEGORIES_REQUIRED', message: 'requested data categories are required' });
    }
    if (request.retentionDays <= 0 || request.onwardUse !== 'NOT_ALLOWED') {
      return err({ code: 'RETENTION_OR_ONWARD_USE', message: 'retention and onward-use terms are invalid' });
    }
    if (request.defaultCompensation.usdConversion !== 'UNAVAILABLE') {
      return err({ code: 'COIN_USD_PRICE_FORBIDDEN', message: 'SunRey Coin must not be assigned a USD price' });
    }
    if (request.prohibitedUses.some((use) => PROHIBITED_USE_CATEGORIES.includes(use))) {
      return err({ code: 'PROHIBITED_USE', message: 'prohibited or heightened-risk use is not automatically authorized' });
    }
    if (request.policyState !== 'SIMULATION_PERMITTED' || request.legalReviewState !== 'RESEARCH_REQUIRED') {
      return err({ code: 'POLICY_BLOCKED', message: 'policy or legal review does not permit publication' });
    }
    if (request.rdtCapability !== 'INFORMATION_MARKET_REQUEST') {
      return err({ code: 'RDT_CAPABILITY_MISSING', message: 'RDT candidate capability is required' });
    }
    return null;
  }

  private reserveCoinIfNeeded(request: MarketRequest, sponsorOwnerId: string): Result<true, InformationMarketFailure> {
    const coinOffers = [request.defaultCompensation, ...request.compensationByIndex].filter((row) => row.asset === 'SUNREY_COIN' && row.coin);
    if (coinOffers.length === 0) return ok(true);
    const total = coinOffers.reduce((sum, row) => sum.plus(row.coin!), AssetQuantity.zero(SUNREY_COIN_ASSET_ID));
    if (total.isZero()) return ok(true);
    const hold = this.coin.placeSimulationHold(this.coin.position(sponsorOwnerId).accountId, total);
    if (!hold.ok) return err({ code: hold.error.code, message: hold.error.message });
    this.coinHoldId = hold.value.holdId;
    return ok(true);
  }

  private putContribution(
    opportunity: UserOpportunity,
    status: ContributionState,
    request: MarketRequest,
    requester: MarketRequester,
  ): ProofOfContribution {
    const existing = this.contributionFor(request.requestId, opportunity.subjectId);
    if (existing) return existing;
    const agreementId = newCompensationAgreementId();
    const contribution: ProofOfContribution = Object.freeze({
      contributionId: newContributionId(),
      subjectRef: subjectRefFor(opportunity.subjectId),
      requesterId: requester.requesterId,
      requestId: request.requestId,
      opportunityId: opportunity.opportunityId,
      consentRef: '',
      purposeRef: request.purposeRef,
      permittedDataCategories: request.requestedDataCategories,
      cleanRoomJobId: '',
      computationReceiptId: '',
      oracleAttestationRefs: Object.freeze(
        this.store.matches
          .filter((row) => row.requestId === request.requestId && row.subjectRef === subjectRefFor(opportunity.subjectId))
          .flatMap((row) => row.attestationIds),
      ),
      status,
      compensationAgreementId: agreementId,
      settlementRef: null,
      provenanceHash: '',
      createdAt: this.clock.now(),
      rawDataIncluded: false,
    });
    this.store.contributions.set(contribution.contributionId, contribution);
    this.store.agreements.set(
      agreementId,
      Object.freeze({
        agreementId,
        contributionId: contribution.contributionId,
        offer: opportunity.compensation,
        realization: 'OFFERED',
      }),
    );
    return contribution;
  }

  private contributionFor(requestId: string, subjectId: string): ProofOfContribution | undefined {
    return [...this.store.contributions.values()].find(
      (row) => row.requestId === requestId && row.subjectRef === subjectRefFor(subjectId),
    );
  }

  private transitionByOpportunity(
    opportunityId: string,
    to: ContributionState,
    patch: Partial<ProofOfContribution> = {},
  ): Result<ProofOfContribution, InformationMarketFailure> {
    const row = [...this.store.contributions.values()].find((item) => item.opportunityId === opportunityId);
    if (!row) return err({ code: 'CONTRIBUTION_UNKNOWN', message: 'contribution not found' });
    return ok(this.transition(row, to, patch));
  }

  private transitionBySubject(requestId: string, subjectId: string, to: ContributionState): ProofOfContribution {
    const row = this.contributionFor(requestId, subjectId);
    if (!row) throw new Error('contribution missing');
    return this.transition(row, to);
  }

  private transition(row: ProofOfContribution, to: ContributionState, patch: Partial<ProofOfContribution> = {}): ProofOfContribution {
    if (!canTransitionContribution(row.status, to)) {
      throw new Error(`illegal contribution transition ${row.status} → ${to}`);
    }
    const next = Object.freeze({ ...row, ...patch, status: to });
    this.store.contributions.set(next.contributionId, next);
    return next;
  }

  private recordSettlement(
    row: ProofOfContribution,
    asset: 'FIAT_MONEY' | 'SUNREY_COIN',
    intentId: string,
    journalId?: string,
    transferId?: string,
    peveRef?: string,
  ): void {
    const settlementRef = newSettlementRefId();
    this.store.settlements.set(
      settlementRef,
      Object.freeze({
        settlementRef,
        contributionId: row.contributionId,
        asset,
        intentId,
        ...(journalId ? { journalId } : {}),
        ...(transferId ? { transferId } : {}),
        realization: 'REALIZED',
        ...(peveRef ? { peveRef } : {}),
      }),
    );
    const agreement = this.store.agreements.get(row.compensationAgreementId);
    if (agreement) {
      this.store.agreements.set(agreement.agreementId, Object.freeze({ ...agreement, realization: 'REALIZED' }));
    }
    this.store.contributions.set(row.contributionId, Object.freeze({ ...row, settlementRef }));
  }

  private recordPeve(actor: unknown, subjectId: string, row: ProofOfContribution, amount: Money): string | undefined {
    if (!this.peve) return undefined;
    const recorded = this.peve.recordDataContribution(actor, {
      subjectId,
      purpose: row.purposeRef,
      consentReference: row.consentRef,
      realizedCompensation: { minorUnits: amount.minorUnits.toString(), currency: amount.currency },
      estimatedLabeled: false,
      provenance: 'VERIFIED',
    });
    if (recorded.ok) {
      this.peve.recordAttribution(actor, {
        subjectId,
        sourceEventId: row.contributionId,
        observedResult: 'realized information-market research compensation',
        amount: { minorUnits: amount.minorUnits.toString(), currency: amount.currency },
        attributionType: 'OTHER_MEASURABLE_IMPROVEMENT',
        realization: 'REALIZED',
        calculationMethod: 'settled_fiat_research_compensation',
        confidence: 'VERIFIED',
        formulaVersion: FORMULA_V1,
        recordedAt: this.clock.now(),
      });
      return recorded.value.referenceId;
    }
    return undefined;
  }

  private refreshDemandIndex(): void {
    const requests = [...this.store.requests.values()];
    const matches = this.store.matches;
    const matched = matches.filter((row) => row.matched).length;
    const completed = [...this.store.contributions.values()].filter((row) => row.status === 'SETTLED' || row.status === 'COMPLETED').length;
    const fiatOffers = [...this.store.agreements.values()].filter((row) => row.offer.fiat);
    const realized = [...this.store.agreements.values()].filter((row) => row.realization === 'REALIZED' && row.offer.fiat);
    const avg = fiatOffers.length
      ? (fiatOffers.reduce((sum, row) => sum + Number(row.offer.fiat!.minorUnits), 0) / fiatOffers.length).toFixed(0)
      : '0';
    const realizedAvg = realized.length
      ? (realized.reduce((sum, row) => sum + Number(row.offer.fiat!.minorUnits), 0) / realized.length).toFixed(0)
      : '0';
    const observation: DemandIndexObservation = Object.freeze({
      observedAt: this.clock.now(),
      requestCount: requests.length,
      categoryDemand: Object.freeze(
        Object.fromEntries(
          requests.flatMap((row) => row.requestedDataCategories).reduce((map, category) => {
            map.set(category, (map.get(category) ?? 0) + 1);
            return map;
          }, new Map<string, number>()),
        ),
      ),
      authorizedContributorSupply: new Set(
        [...this.store.contributions.values()].filter((row) => row.consentRef).map((row) => row.subjectRef),
      ).size,
      matchRate: matches.length === 0 ? '0' : (matched / matches.length).toFixed(2),
      completedComputationCount: completed,
      averageOfferedFiatMinor: avg,
      realizedClearingFiatMinor: realizedAvg,
      geography: Object.freeze(Object.fromEntries(requests.map((row) => [row.jurisdiction, 1]))),
      requesterTypeCounts: Object.freeze(
        Object.fromEntries(
          [...this.store.requesters.values()].map((row) => [row.kind, 1]),
        ),
      ),
      timeToFillMs: null,
      isCoinPrice: false,
      isHumanWorth: false,
      isGuaranteedCompensation: false,
      isTokenValuation: false,
    });
    this.store.observations.push(observation);
  }

  private emit(eventType: string, aggregateId: string, payload: Record<string, unknown>): void {
    this.events.append({
      eventType: eventType as never,
      schemaVersion: 1,
      occurredAt: this.clock.now(),
      aggregateType: eventType.startsWith('Oracle') ? 'oracle' : 'information_market',
      aggregateId,
      payload,
    });
  }

  private seal(kind: string, payload: Record<string, unknown>): void {
    this.evidence.seal(`${EVIDENCE_KIND_INFORMATION_MARKET}:${kind}`, {
      ...payload,
      kind,
      simulation: true,
      rawDataIncluded: false,
    });
  }
}
