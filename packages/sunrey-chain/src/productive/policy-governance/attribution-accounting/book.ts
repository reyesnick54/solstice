import { sha256Hex } from '../../../../../security/src/hash.ts';
import { buildReplayKeys, canonicalUnitId, deriveEconomicEventId } from './identity.ts';
import { remainingShare, shareWouldExceed } from './shares.ts';
import {
  ATTRIBUTION_ACCOUNTING_DOMAIN,
  ATTRIBUTION_ACCOUNTING_SCHEMA_VERSION,
  ATTRIBUTION_BOOK_IS_MONETARY_LEDGER,
  ATTRIBUTION_BOOK_STORES_MOONREY_BALANCE,
  DEFAULT_MAXIMUM_AGGREGATE_SHARE,
  attributionFailure,
  isIndependentServiceCategory,
  type AttributionCorrectionRecord,
  type AttributionEntryStatus,
  type AttributionEventObservation,
  type AttributionFailure,
  type AttributionInvariantViolation,
  type AttributionIssuanceStatus,
  type AttributionRejectionCode,
  type AttributionReservationRequest,
  type AttributionResult,
  type ProductiveAttributionDecision,
  type ProductiveAttributionEntry,
  type ProductiveAttributionReconciliationReport,
} from './types.ts';
import { observationsOverlap, windowsOverlap } from './windows.ts';

export type AttributionAttemptRecord = {
  readonly code: AttributionRejectionCode;
  readonly economicEventId: string;
  readonly claimId: string;
  readonly contributionId: string;
};

function stableEvidenceKey(observation: AttributionEventObservation): string {
  return sha256Hex(
    [
      ATTRIBUTION_ACCOUNTING_DOMAIN,
      'stable-evidence',
      observation.geographyId,
      observation.batchId ?? '',
      observation.lotId ?? '',
      observation.sourceQuantity.toString(),
      canonicalUnitId(observation.sourceUnitId),
      [...observation.oracleFactIds].sort().join(','),
      observation.independentlyEvidenced === true ? 'independent' : 'tied',
    ].join('|'),
  );
}

function activeStatus(status: AttributionEntryStatus): boolean {
  return status === 'RESERVED' || status === 'FINALIZED';
}

function decisionMatchesObservation(
  observation: AttributionEventObservation,
  decision: ProductiveAttributionDecision,
): AttributionFailure | undefined {
  if (decision.claimId !== observation.claimId) {
    return attributionFailure('ATTRIBUTION_DECISION_REQUIRED', 'decision claimId does not match observation');
  }
  if (decision.contributionId !== observation.contributionId) {
    return attributionFailure('ATTRIBUTION_DECISION_REQUIRED', 'decision contributionId does not match observation');
  }
  if (decision.category !== observation.category) {
    return attributionFailure('ATTRIBUTION_DECISION_REQUIRED', 'decision category does not match observation');
  }
  if (decision.claimType !== observation.claimType) {
    return attributionFailure('ATTRIBUTION_DECISION_REQUIRED', 'decision claimType does not match observation');
  }
  return undefined;
}

/**
 * In-memory simulation book. Not a monetary ledger and not distributed locking.
 */
export class ProductiveAttributionBook {
  readonly isMonetaryLedger = ATTRIBUTION_BOOK_IS_MONETARY_LEDGER;
  readonly storesMoonReyBalance = ATTRIBUTION_BOOK_STORES_MOONREY_BALANCE;
  readonly isAssetSupplyBook = false;
  readonly isCustomerLedger = false;
  readonly isWalletBalance = false;
  readonly isMoonReySupply = false;
  readonly isExchangeBalance = false;

  private readonly entries = new Map<string, ProductiveAttributionEntry>();
  private readonly corrections: AttributionCorrectionRecord[] = [];
  private readonly attempts: AttributionAttemptRecord[] = [];
  private readonly knownEventIds = new Set<string>();
  private seq = 0;

  snapshotEntries(): readonly ProductiveAttributionEntry[] {
    return [...this.entries.values()].map((entry) => Object.freeze({ ...entry }));
  }

  snapshotCorrections(): readonly AttributionCorrectionRecord[] {
    return this.corrections.map((item) => Object.freeze({ ...item }));
  }

  getEntry(entryId: string): ProductiveAttributionEntry | undefined {
    const entry = this.entries.get(entryId);
    return entry ? Object.freeze({ ...entry }) : undefined;
  }

  activeEntriesForEvent(economicEventId: string): readonly ProductiveAttributionEntry[] {
    return this.snapshotEntries().filter((entry) => entry.economicEventId === economicEventId && activeStatus(entry.status));
  }

  allocatedShareForEvent(economicEventId: string): bigint {
    return this.activeEntriesForEvent(economicEventId).reduce((sum, entry) => sum + entry.allocatedShare, 0n);
  }

  remainingShareForEvent(economicEventId: string, maximum = DEFAULT_MAXIMUM_AGGREGATE_SHARE): bigint {
    return remainingShare(maximum, this.allocatedShareForEvent(economicEventId));
  }

  reserve(request: AttributionReservationRequest): AttributionResult<ProductiveAttributionEntry> {
    const { observation, decision, expectedPolicyVersion } = request;
    const mismatch = decisionMatchesObservation(observation, decision);
    if (mismatch) {
      this.recordAttempt(mismatch.code, decision.economicEventId, observation);
      return mismatch;
    }
    if (decision.attributionPolicyVersion !== expectedPolicyVersion) {
      const failure = attributionFailure(
        'ATTRIBUTION_POLICY_VERSION_MISMATCH',
        `decision policy ${decision.attributionPolicyVersion} does not match expected ${expectedPolicyVersion}`,
      );
      this.recordAttempt(failure.code, decision.economicEventId, observation);
      return failure;
    }
    if (decision.allocatedShare <= 0n) {
      const failure = attributionFailure('ATTRIBUTION_SHARE_EXHAUSTED', 'allocated share must be positive');
      this.recordAttempt(failure.code, decision.economicEventId, observation);
      return failure;
    }
    if (decision.allocatedShare > decision.maximumAggregateShare) {
      const failure = attributionFailure('EVENT_OVERALLOCATED', 'decision allocated share exceeds policy maximum');
      this.recordAttempt(failure.code, decision.economicEventId, observation);
      return failure;
    }

    const keys = buildReplayKeys(observation, decision);
    const priorIdempotent = [...this.entries.values()].find((entry) => entry.replayKeys.idempotencyKey === keys.idempotencyKey);
    if (priorIdempotent && activeStatus(priorIdempotent.status)) {
      return { ok: true, value: Object.freeze({ ...priorIdempotent }), idempotentReplay: true };
    }

    const replay = this.detectReplay(observation, decision, keys);
    if (replay) {
      this.recordAttempt(replay.code, decision.economicEventId, observation);
      return replay;
    }

    const family = this.familyEntries(observation);
    const familyAllocated = family.reduce((sum, entry) => sum + entry.allocatedShare, 0n);
    const lineageCheck = this.evaluateLineage(observation, decision, familyAllocated);
    if (lineageCheck) {
      this.recordAttempt(lineageCheck.code, decision.economicEventId, observation);
      return lineageCheck;
    }

    const eventId = decision.economicEventId;
    const combinedAllocated = this.allocatedShareForEvent(eventId) + this.relatedAllocated(decision, observation);
    if (shareWouldExceed(decision.maximumAggregateShare, combinedAllocated, decision.allocatedShare)) {
      const code = familyAllocated > 0n && this.hasOverlappingFamily(observation, family)
        ? 'OVERLAPPING_WINDOW_DUPLICATE'
        : combinedAllocated >= decision.maximumAggregateShare
          ? 'ATTRIBUTION_SHARE_EXHAUSTED'
          : 'EVENT_OVERALLOCATED';
      const failure = attributionFailure(
        code,
        `requested ${decision.allocatedShare} with allocated ${combinedAllocated} exceeds maximum ${decision.maximumAggregateShare}`,
      );
      this.recordAttempt(failure.code, eventId, observation);
      return failure;
    }

    this.seq += 1;
    const remaining = remainingShare(decision.maximumAggregateShare, combinedAllocated + decision.allocatedShare);
    const entry: ProductiveAttributionEntry = Object.freeze({
      schemaVersion: ATTRIBUTION_ACCOUNTING_SCHEMA_VERSION,
      entryId: `attr:${this.seq}:${keys.idempotencyKey.slice(0, 16)}`,
      economicEventId: eventId,
      eventFingerprint: decision.eventFingerprint,
      claimId: decision.claimId,
      contributionId: decision.contributionId,
      category: decision.category,
      claimType: decision.claimType,
      attributionPolicyVersion: decision.attributionPolicyVersion,
      attributionDecisionId: decision.attributionDecisionId,
      allocatedShare: decision.allocatedShare,
      remainingShareAtCommit: remaining,
      relatedEventIds: [...decision.relatedEventIds, ...(observation.lineage?.parentEventIds ?? []), ...(observation.lineage?.childEventIds ?? [])],
      relatedContributionIds: [...decision.relatedContributionIds],
      status: 'RESERVED',
      issuanceStatus: 'NOT_VALUED',
      independentlyEvidenced: observation.independentlyEvidenced === true || decision.independentlyEvidenced,
      observation: Object.freeze({ ...observation, oracleFactIds: [...observation.oracleFactIds] }),
      replayKeys: keys,
      createdAtSeq: this.seq,
      supersededByEntryId: null,
      releasedByCorrectionId: null,
      monetaryAdjustmentReviewRequired: false,
      isMonetaryLedger: false,
      storesMoonReyBalance: false,
    });
    this.entries.set(entry.entryId, entry);
    this.knownEventIds.add(eventId);
    return { ok: true, value: entry, idempotentReplay: false };
  }

  finalize(entryId: string): AttributionResult<ProductiveAttributionEntry> {
    const entry = this.entries.get(entryId);
    if (!entry) {
      return attributionFailure('ATTRIBUTION_DECISION_REQUIRED', `unknown reservation ${entryId}`);
    }
    if (entry.status === 'FINALIZED') {
      return { ok: true, value: Object.freeze({ ...entry }), idempotentReplay: true };
    }
    if (entry.status !== 'RESERVED') {
      return attributionFailure('CORRECTION_REQUIRED', `entry ${entryId} is ${entry.status} and cannot finalize`);
    }
    const finalized = Object.freeze({ ...entry, status: 'FINALIZED' as const });
    this.entries.set(entryId, finalized);
    return { ok: true, value: finalized, idempotentReplay: false };
  }

  noteIssuanceStatus(entryId: string, status: AttributionIssuanceStatus): AttributionResult<ProductiveAttributionEntry> {
    const entry = this.entries.get(entryId);
    if (!entry) {
      return attributionFailure('ATTRIBUTION_DECISION_REQUIRED', `unknown entry ${entryId}`);
    }
    const next = Object.freeze({ ...entry, issuanceStatus: status });
    this.entries.set(entryId, next);
    return { ok: true, value: next, idempotentReplay: entry.issuanceStatus === status };
  }

  correct(input: {
    readonly targetEntryId: string;
    readonly reason: string;
    readonly evidenceIds: readonly string[];
    readonly replacement?: AttributionReservationRequest;
    readonly supersede: boolean;
  }): AttributionResult<{
    readonly correction: AttributionCorrectionRecord;
    readonly released: ProductiveAttributionEntry;
    readonly replacement?: ProductiveAttributionEntry | undefined;
  }> {
    const target = this.entries.get(input.targetEntryId);
    if (!target) {
      return attributionFailure('CORRECTION_REQUIRED', `unknown attribution ${input.targetEntryId}`);
    }
    if (target.status === 'RELEASED_BY_CORRECTION' || target.status === 'SUPERSEDED') {
      const existing = this.corrections.find((item) => item.targetEntryId === target.entryId);
      if (existing) {
        return {
          ok: true,
          value: {
            correction: existing,
            released: target,
          },
          idempotentReplay: true,
        };
      }
    }
    const settled = target.issuanceStatus === 'SETTLED';
    this.seq += 1;
    const released: ProductiveAttributionEntry = Object.freeze({
      ...target,
      status: input.supersede ? 'SUPERSEDED' : 'RELEASED_BY_CORRECTION',
      releasedByCorrectionId: `corr:${this.seq}`,
      monetaryAdjustmentReviewRequired: settled,
    });
    this.entries.set(target.entryId, released);

    let replacement: ProductiveAttributionEntry | undefined;
    if (input.replacement) {
      const reserved = this.reserve(input.replacement);
      if (!reserved.ok) {
        this.entries.set(target.entryId, target);
        return reserved;
      }
      replacement = reserved.value;
      this.entries.set(target.entryId, Object.freeze({ ...released, supersededByEntryId: replacement.entryId }));
    }

    const correction: AttributionCorrectionRecord = Object.freeze({
      schemaVersion: ATTRIBUTION_ACCOUNTING_SCHEMA_VERSION,
      correctionId: released.releasedByCorrectionId ?? `corr:${this.seq}`,
      targetEntryId: target.entryId,
      reason: input.reason,
      evidenceIds: [...input.evidenceIds],
      replacementDecisionId: input.replacement?.decision.attributionDecisionId ?? null,
      replacementEntryId: replacement?.entryId ?? null,
      releasedShare: target.allocatedShare,
      rewritesHistory: false,
      silentlyErasesFinalizedEvidence: false,
      clawbackExecuted: false,
      monetaryAdjustmentReviewRequired: settled,
      createdAtSeq: this.seq,
    });
    this.corrections.push(correction);
    if (settled) {
      return {
        ok: false,
        code: 'MONETARY_ADJUSTMENT_REVIEW_REQUIRED',
        detail: `correction ${correction.correctionId} recorded; settlement already occurred and balances were not modified`,
      };
    }
    return { ok: true, value: { correction, released, replacement }, idempotentReplay: false };
  }

  reconcile(unattributedEventIds: readonly string[] = []): ProductiveAttributionReconciliationReport {
    const entries = this.snapshotEntries();
    const eventIds = new Set<string>([...this.knownEventIds, ...unattributedEventIds]);
    for (const entry of entries) {
      eventIds.add(entry.economicEventId);
    }
    const claims = new Set(entries.map((entry) => entry.claimId));
    const contributions = new Set(entries.map((entry) => entry.contributionId));
    let fullyAttributedEvents = 0;
    let partiallyAttributedEvents = 0;
    let overAllocatedEvents = 0;
    let unattributedEvents = 0;
    let ambiguousEvents = 0;
    const invariantViolations: AttributionInvariantViolation[] = [];

    for (const eventId of eventIds) {
      const active = this.activeEntriesForEvent(eventId);
      const allocated = active.reduce((sum, entry) => sum + entry.allocatedShare, 0n);
      const maximum = active[0]?.attributionPolicyVersion !== undefined
        ? DEFAULT_MAXIMUM_AGGREGATE_SHARE
        : DEFAULT_MAXIMUM_AGGREGATE_SHARE;
      if (active.length === 0) {
        unattributedEvents += 1;
        continue;
      }
      if (allocated > maximum) {
        overAllocatedEvents += 1;
        invariantViolations.push({
          code: 'AGGREGATE_SHARE_EXCEEDED',
          economicEventId: eventId,
          detail: `allocated ${allocated} exceeds maximum ${maximum}`,
        });
      } else if (allocated === maximum) {
        fullyAttributedEvents += 1;
      } else {
        partiallyAttributedEvents += 1;
      }
      const categories = new Set(active.map((entry) => entry.category));
      if (categories.size > 1 && active.some((entry) => !entry.independentlyEvidenced)) {
        ambiguousEvents += 1;
      }
    }

    const replayAttempts = this.attempts.filter((item) =>
      item.code === 'EVENT_REPLAY' ||
      item.code === 'CLAIM_REPLAY' ||
      item.code === 'CONTRIBUTION_REPLAY' ||
      item.code === 'CATEGORY_RELABEL_DUPLICATE' ||
      item.code === 'OBJECT_RELABEL_DUPLICATE' ||
      item.code === 'CONTROLLER_RELABEL_DUPLICATE',
    ).length;
    const duplicateAttempts = this.attempts.filter((item) =>
      item.code === 'EVENT_REPLAY' || item.code === 'CLAIM_REPLAY' || item.code === 'CONTRIBUTION_REPLAY',
    ).length;
    const overlappingWindowAttempts = this.attempts.filter((item) => item.code === 'OVERLAPPING_WINDOW_DUPLICATE').length;
    const batchSplitEvents = entries.filter((entry) => entry.relatedEventIds.length > 0).length;
    const settledCorrectionsRequiringReview = this.corrections.filter((item) => item.monetaryAdjustmentReviewRequired).length;

    return Object.freeze({
      schemaVersion: ATTRIBUTION_ACCOUNTING_SCHEMA_VERSION,
      eventsAnalyzed: eventIds.size,
      claimsAnalyzed: claims.size,
      contributionsAnalyzed: contributions.size,
      fullyAttributedEvents,
      partiallyAttributedEvents,
      overAllocatedEvents,
      unattributedEvents,
      ambiguousEvents,
      duplicateAttempts,
      replayAttempts,
      overlappingWindowAttempts,
      batchSplitEvents,
      corrections: this.corrections.length,
      settledCorrectionsRequiringReview,
      invariantViolations: Object.freeze(invariantViolations),
      isMonetaryLedger: false,
    });
  }

  private detectReplay(
    observation: AttributionEventObservation,
    decision: ProductiveAttributionDecision,
    keys: ReturnType<typeof buildReplayKeys>,
  ): AttributionFailure | undefined {
    const active = [...this.entries.values()].filter((entry) => activeStatus(entry.status));
    const independent = observation.independentlyEvidenced === true && isIndependentServiceCategory(observation.category);

    for (const entry of active) {
      if (entry.contributionId === observation.contributionId && entry.replayKeys.idempotencyKey !== keys.idempotencyKey) {
        return attributionFailure('CONTRIBUTION_REPLAY', `contribution ${observation.contributionId} already attributed`);
      }
      if (entry.claimId === observation.claimId && entry.replayKeys.idempotencyKey !== keys.idempotencyKey) {
        return attributionFailure('CLAIM_REPLAY', `claim ${observation.claimId} already attributed`);
      }
      if (
        entry.replayKeys.observationFingerprint === keys.observationFingerprint &&
        entry.category === observation.category &&
        entry.contributionId !== observation.contributionId
      ) {
        return attributionFailure('CONTRIBUTION_REPLAY', 'contribution evidence already attributed under another id');
      }
      if (
        entry.replayKeys.evidenceFingerprint === keys.evidenceFingerprint &&
        entry.category === observation.category &&
        entry.claimId !== observation.claimId
      ) {
        return attributionFailure('CLAIM_REPLAY', 'claim evidence already attributed under another id');
      }
      if (independent) {
        continue;
      }
      if (entry.replayKeys.evidenceFingerprint === keys.evidenceFingerprint && entry.economicEventId !== decision.economicEventId) {
        return attributionFailure('EVENT_REPLAY', 'oracle evidence already attributed to another event object');
      }
      if (entry.replayKeys.observationFingerprint === keys.observationFingerprint && entry.economicEventId !== decision.economicEventId) {
        return attributionFailure('EVENT_REPLAY', 'canonical event observation already attributed');
      }
      if (
        entry.replayKeys.categoryStrippedFingerprint === keys.categoryStrippedFingerprint &&
        entry.category !== observation.category &&
        entry.economicEventId !== decision.economicEventId
      ) {
        return attributionFailure('CATEGORY_RELABEL_DUPLICATE', `category relabel ${observation.category} of ${entry.category}`);
      }
      if (
        entry.replayKeys.objectStrippedFingerprint === keys.objectStrippedFingerprint &&
        entry.observation.objectId !== observation.objectId &&
        entry.economicEventId !== decision.economicEventId
      ) {
        return attributionFailure('OBJECT_RELABEL_DUPLICATE', 'object relabel of an already attributed event');
      }
      if (
        entry.replayKeys.controllerStrippedFingerprint === keys.controllerStrippedFingerprint &&
        entry.observation.controllerId !== observation.controllerId &&
        entry.economicEventId !== decision.economicEventId
      ) {
        return attributionFailure('CONTROLLER_RELABEL_DUPLICATE', 'controller relabel of an already attributed event');
      }
    }

    if (!independent && this.hasOverlappingFamily(observation, this.familyEntries(observation))) {
      const familyAllocated = this.familyEntries(observation).reduce((sum, entry) => sum + entry.allocatedShare, 0n);
      if (shareWouldExceed(decision.maximumAggregateShare, familyAllocated, decision.allocatedShare)) {
        return attributionFailure(
          'OVERLAPPING_WINDOW_DUPLICATE',
          'overlapping window would consume attribution already reserved for this production interval',
        );
      }
    }
    return undefined;
  }

  private familyEntries(observation: AttributionEventObservation): ProductiveAttributionEntry[] {
    const key = stableEvidenceKey(observation);
    return [...this.entries.values()].filter((entry) => activeStatus(entry.status) && stableEvidenceKey(entry.observation) === key);
  }

  private hasOverlappingFamily(
    observation: AttributionEventObservation,
    family: readonly ProductiveAttributionEntry[],
  ): boolean {
    return family.some((entry) =>
      observationsOverlap(entry.observation, observation) ||
      windowsOverlap(
        entry.observation.validFromUnixSeconds,
        entry.observation.validUntilUnixSeconds,
        observation.validFromUnixSeconds,
        observation.validUntilUnixSeconds,
      ),
    );
  }

  private evaluateLineage(
    observation: AttributionEventObservation,
    decision: ProductiveAttributionDecision,
    familyAllocated: bigint,
  ): AttributionFailure | undefined {
    const lineage = observation.lineage;
    if (!lineage) {
      return undefined;
    }
    if (lineage.kind === 'SPLIT') {
      const parentAllocated = lineage.parentEventIds.reduce((sum, eventId) => sum + this.allocatedShareForEvent(eventId), 0n);
      const childAllocated = lineage.childEventIds.reduce((sum, eventId) => sum + this.allocatedShareForEvent(eventId), 0n);
      if (shareWouldExceed(decision.maximumAggregateShare, childAllocated + familyAllocated, decision.allocatedShare) && parentAllocated <= decision.maximumAggregateShare) {
        return attributionFailure(
          'BATCH_SPLIT_OVERALLOCATION',
          'batch split would increase attributable underlying production',
        );
      }
      if (parentAllocated + decision.allocatedShare + childAllocated > decision.maximumAggregateShare && parentAllocated > 0n) {
        return attributionFailure(
          'BATCH_SPLIT_OVERALLOCATION',
          'split children plus parent exceed original attributable production',
        );
      }
    }
    if (lineage.kind === 'MERGE' || lineage.kind === 'LOT_AGGREGATION') {
      const parentAllocated = lineage.parentEventIds.reduce((sum, eventId) => sum + this.allocatedShareForEvent(eventId), 0n);
      if (parentAllocated > 0n && decision.allocatedShare > 0n) {
        return attributionFailure(
          'BATCH_MERGE_DUPLICATE',
          'merged batch cannot fabricate new goods production',
        );
      }
      if (parentAllocated === 0n && familyAllocated + decision.allocatedShare > decision.maximumAggregateShare) {
        return attributionFailure('BATCH_MERGE_DUPLICATE', 'merged batch duplicates already attributed lots');
      }
    }
    return undefined;
  }

  private relatedAllocated(
    decision: ProductiveAttributionDecision,
    observation: AttributionEventObservation,
  ): bigint {
    const related = new Set([...decision.relatedEventIds, ...(observation.lineage?.parentEventIds ?? [])]);
    let extra = 0n;
    for (const eventId of related) {
      if (eventId !== decision.economicEventId) {
        extra += this.allocatedShareForEvent(eventId);
      }
    }
    if (observation.independentlyEvidenced === true && isIndependentServiceCategory(observation.category)) {
      return 0n;
    }
    extra += this.familyEntries(observation)
      .filter((entry) => entry.economicEventId !== decision.economicEventId)
      .reduce((sum, entry) => sum + entry.allocatedShare, 0n);
    return extra;
  }

  private recordAttempt(code: AttributionRejectionCode, economicEventId: string, observation: AttributionEventObservation): void {
    this.attempts.push({
      code,
      economicEventId,
      claimId: observation.claimId,
      contributionId: observation.contributionId,
    });
  }
}

export function simulationAttributionDecision(
  observation: AttributionEventObservation,
  input: {
    readonly attributionDecisionId: string;
    readonly attributionPolicyVersion?: number;
    readonly allocatedShare?: bigint;
    readonly maximumAggregateShare?: bigint;
    readonly relatedEventIds?: readonly string[];
    readonly relatedContributionIds?: readonly string[];
    readonly independentlyEvidenced?: boolean;
  },
): ProductiveAttributionDecision {
  const eventFingerprint = input.relatedEventIds ? observation.economicEventId : deriveEconomicEventId(observation);
  return Object.freeze({
    schemaVersion: ATTRIBUTION_ACCOUNTING_SCHEMA_VERSION,
    attributionDecisionId: input.attributionDecisionId,
    attributionPolicyVersion: input.attributionPolicyVersion ?? 1,
    economicEventId: observation.economicEventId,
    eventFingerprint,
    claimId: observation.claimId,
    contributionId: observation.contributionId,
    category: observation.category,
    claimType: observation.claimType,
    allocatedShare: input.allocatedShare ?? DEFAULT_MAXIMUM_AGGREGATE_SHARE,
    maximumAggregateShare: input.maximumAggregateShare ?? DEFAULT_MAXIMUM_AGGREGATE_SHARE,
    relatedEventIds: [...(input.relatedEventIds ?? [])],
    relatedContributionIds: [...(input.relatedContributionIds ?? [])],
    independentlyEvidenced: input.independentlyEvidenced ?? observation.independentlyEvidenced === true,
    attributionSensitive: true,
    policyAccepts: true,
  });
}
