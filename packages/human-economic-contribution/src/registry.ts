import { err, ok, type Result } from '../../domain/src/result.ts';
import { createHumanContributionEvent, refuseExecution, refuseMint } from './event.ts';
import { DEFAULT_VERIFICATION_POLICY_VERSION } from './fingerprint.ts';
import type { ContributionFingerprint, ContributionId, PolicyDecisionRef, SubjectRef } from './ids.ts';
import { isNonAuthoritativeSource, type SettlementEligibilityState } from './taxonomy.ts';
import { ContributionQueryIndex, periodOverlaps } from './projections.ts';
import type { HumanContributionRegistryPort } from './port.ts';
import { asVerifiedReference, registryRecordFromEvent, replaceRecordEvent } from './record.ts';
import type { HumanContributionRegistryStore } from './store.ts';
import type {
  ContributionClassCount,
  ContributionFailure,
  ContributionQuery,
  DuplicateAttempt,
  ExecutionRefusal,
  HumanContributionEvent,
  HumanContributionRegistryAudit,
  HumanContributionRegistryRecord,
  HumanContributionRegistrySnapshot,
  JurisdictionCount,
  MintRefusal,
  RecordContributionInput,
  RejectContributionInput,
  VerifiedContributionReference,
  VerifyContributionInput,
} from './types.ts';

export type { HumanContributionRegistrySnapshot } from './types.ts';

const ACTIVE_STATUSES = new Set(['OBSERVED', 'SUBMITTED', 'VERIFICATION_REQUIRED', 'VERIFIED']);
const TERMINAL_STATUSES = new Set(['REJECTED', 'SUPERSEDED', 'CORRECTED']);
const VERIFIABLE_STATUSES = new Set(['OBSERVED', 'SUBMITTED', 'VERIFICATION_REQUIRED']);

function failure(code: ContributionFailure['code'], message: string): ContributionFailure {
  return Object.freeze({ code, message });
}

/**
 * Canonical Human Economic Contribution registry — system of record
 * for verified contribution records. Later chunks may persist or
 * settle against these records. This owner does not value, mint,
 * issue Execution Authority, or post ledger journals.
 */
export class HumanContributionRegistry implements HumanContributionRegistryPort {
  private readonly records = new Map<ContributionId, HumanContributionRegistryRecord>();
  private readonly indexes = new ContributionQueryIndex();
  private readonly duplicateAttempts: DuplicateAttempt[] = [];
  private readonly store: HumanContributionRegistryStore | undefined;
  private projectionsReady = true;

  constructor(store?: HumanContributionRegistryStore) {
    this.store = store;
  }

  record(input: RecordContributionInput): Result<HumanContributionEvent, ContributionFailure> {
    const created = this.insert(input);
    if (!created.ok) {
      return created;
    }
    return ok(created.value.event);
  }

  submit(input: RecordContributionInput): Result<HumanContributionRegistryRecord, ContributionFailure> {
    const existing = input.contributionId ? this.records.get(input.contributionId) : undefined;
    if (existing) {
      return ok(existing);
    }
    const { status, ...rest } = input;
    if (status && status !== 'VERIFIED') {
      return this.insert({ ...rest, status });
    }
    return this.insert(rest);
  }

  verify(input: VerifyContributionInput): Result<HumanContributionRegistryRecord, ContributionFailure> {
    const current = this.records.get(input.contributionId);
    if (!current) {
      return err(failure('CONTRIBUTION_NOT_FOUND', `contribution ${input.contributionId} was not recorded`));
    }
    if (current.status === 'VERIFIED') {
      return ok(current);
    }
    if (!VERIFIABLE_STATUSES.has(current.status)) {
      return err(failure('ALREADY_TERMINAL', `contribution ${input.contributionId} cannot be verified from ${current.status}`));
    }
    if (isNonAuthoritativeSource(current.sourceClass)) {
      return err(
        failure(
          current.sourceClass === 'MODEL_INFERENCE' ? 'MODEL_INFERENCE_CANNOT_VERIFY' : 'NOT_VERIFIABLE',
          `${current.sourceClass} cannot be registered as a verified contribution`,
        ),
      );
    }
    const holder = this.activeVerifiedHolder(current.fingerprint, current.contributionId);
    if (holder) {
      this.noteDuplicate(current.fingerprint, current.contributionId, input.verificationTimestamp);
      return err(
        failure(
          'DUPLICATE_FINGERPRINT',
          `active verified fingerprint ${current.fingerprint} is already held by ${holder}`,
        ),
      );
    }
    const policy = input.verificationPolicyVersion ?? DEFAULT_VERIFICATION_POLICY_VERSION;
    const nextEvent: HumanContributionEvent = Object.freeze({
      ...current.event,
      status: 'VERIFIED',
      verificationQuality: current.event.verificationQuality === 'AUTHORITATIVE_REFERENCE' ? 'AUTHORITATIVE_REFERENCE' : 'VERIFIED',
      dataQuality: 'CURRENT',
    });
    const next = replaceRecordEvent(current, nextEvent, {
      verificationPolicyVersion: policy,
      verificationTimestamp: input.verificationTimestamp,
      verifiedMeasurement: nextEvent.measurement,
    });
    this.put(next);
    return ok(next);
  }

  reject(input: RejectContributionInput): Result<HumanContributionRegistryRecord, ContributionFailure> {
    const current = this.records.get(input.contributionId);
    if (!current) {
      return err(failure('CONTRIBUTION_NOT_FOUND', `contribution ${input.contributionId} was not recorded`));
    }
    if (current.status === 'REJECTED') {
      return ok(current);
    }
    if (!VERIFIABLE_STATUSES.has(current.status)) {
      return err(failure('ALREADY_TERMINAL', `contribution ${input.contributionId} cannot be rejected from ${current.status}`));
    }
    if (!/^[A-Z][A-Z0-9_]{1,64}$/.test(input.reasonCode)) {
      return err(failure('INVALID_LIFECYCLE', 'reject reason must be a coded reference, not narrative personal data'));
    }
    const nextEvent: HumanContributionEvent = Object.freeze({
      ...current.event,
      status: 'REJECTED',
      dataQuality: 'INCOMPLETE',
    });
    const next = replaceRecordEvent(current, nextEvent);
    this.put(next);
    return ok(next);
  }

  get(contributionId: ContributionId): HumanContributionEvent | undefined {
    return this.records.get(contributionId)?.event;
  }

  getRecord(contributionId: ContributionId): HumanContributionRegistryRecord | undefined {
    return this.records.get(contributionId);
  }

  getVerifiedReference(contributionId: ContributionId): VerifiedContributionReference | undefined {
    const record = this.records.get(contributionId);
    return record ? asVerifiedReference(record) : undefined;
  }

  listBySubject(subjectRef: SubjectRef): readonly HumanContributionEvent[] {
    return Object.freeze(
      [...this.records.values()]
        .filter((record) => record.subjectRef === subjectRef)
        .map((record) => record.event)
        .sort((left, right) => (left.createdAt < right.createdAt ? -1 : 1)),
    );
  }

  history(contributionId: ContributionId): readonly HumanContributionEvent[] {
    const chain: HumanContributionEvent[] = [];
    const seen = new Set<ContributionId>();
    let current = this.records.get(contributionId);
    while (current && !seen.has(current.contributionId)) {
      seen.add(current.contributionId);
      chain.push(current.event);
      current = current.supersedes ? this.records.get(current.supersedes) : undefined;
    }
    return Object.freeze(chain);
  }

  query(criteria: ContributionQuery): readonly HumanContributionRegistryRecord[] {
    const indexed = this.projectionsReady ? this.indexes.matchingIds(criteria) : null;
    const candidates = indexed
      ? indexed.map((id) => this.records.get(id)).filter((record): record is HumanContributionRegistryRecord => record !== undefined)
      : [...this.records.values()];
    return Object.freeze(
      candidates
        .filter((record) => {
          if (criteria.verifiedOnly && record.status !== 'VERIFIED') {
            return false;
          }
          if (criteria.status && record.status !== criteria.status) {
            return false;
          }
          return periodOverlaps(
            record.measurementPeriod.start,
            record.measurementPeriod.end,
            criteria.periodStart,
            criteria.periodEnd,
          );
        })
        .sort((left, right) => (left.createdAt < right.createdAt ? -1 : 1)),
    );
  }

  supersede(
    priorId: ContributionId,
    input: RecordContributionInput,
  ): Result<HumanContributionEvent, ContributionFailure> {
    const prior = this.records.get(priorId);
    if (!prior) {
      return err(failure('CONTRIBUTION_NOT_FOUND', `contribution ${priorId} was not recorded`));
    }
    if (prior.status === 'SUPERSEDED' || prior.status === 'CORRECTED' || prior.supersededBy) {
      return err(failure('ALREADY_SUPERSEDED', `contribution ${priorId} is already superseded and remains historically traceable`));
    }
    const next = this.insert(
      {
        ...input,
        subjectRef: input.subjectRef ?? prior.subjectRef,
        supersedes: priorId,
      },
      priorId,
    );
    if (!next.ok) {
      return next;
    }
    this.retire(prior, next.value.contributionId, 'SUPERSEDED');
    return ok(next.value.event);
  }

  correct(
    priorId: ContributionId,
    input: RecordContributionInput,
  ): Result<HumanContributionRegistryRecord, ContributionFailure> {
    const prior = this.records.get(priorId);
    if (!prior) {
      return err(failure('CONTRIBUTION_NOT_FOUND', `contribution ${priorId} was not recorded`));
    }
    if (prior.status === 'SUPERSEDED' || prior.status === 'CORRECTED' || prior.supersededBy) {
      return err(failure('ALREADY_SUPERSEDED', `contribution ${priorId} is already corrected or superseded`));
    }
    if (input.supersedes && input.supersedes !== priorId) {
      return err(failure('CORRECTION_TARGET_REQUIRED', 'a correction must explicitly reference the record it supersedes'));
    }
    const next = this.insert(
      {
        ...input,
        subjectRef: input.subjectRef ?? prior.subjectRef,
        supersedes: priorId,
      },
      priorId,
    );
    if (!next.ok) {
      return next;
    }
    const corrected = replaceRecordEvent(
      next.value,
      Object.freeze({
        ...next.value.event,
      }),
      { corrects: priorId },
    );
    this.put(corrected);
    this.retire(prior, corrected.contributionId, 'CORRECTED');
    return ok(this.records.get(corrected.contributionId) ?? corrected);
  }

  applySettlementEligibility(
    contributionId: ContributionId,
    eligibilityState: SettlementEligibilityState,
    policyDecisionRef: PolicyDecisionRef,
  ): Result<HumanContributionEvent, ContributionFailure> {
    const current = this.records.get(contributionId);
    if (!current) {
      return err(failure('CONTRIBUTION_NOT_FOUND', `contribution ${contributionId} was not recorded`));
    }
    if (eligibilityState === 'SETTLEMENT_ELIGIBLE_BY_POLICY' && !policyDecisionRef) {
      return err(failure('POLICY_REF_REQUIRED', 'settlement eligibility is policy-controlled'));
    }
    const updatedEvent: HumanContributionEvent = Object.freeze({
      ...current.event,
      eligibilityState,
      policyDecisionRef,
      issuanceEligible: false,
      sunReyQuantity: null,
    });
    const updated = replaceRecordEvent(current, updatedEvent);
    this.put(updated);
    return ok(updated.event);
  }

  authorizeExecution(event: HumanContributionEvent): ExecutionRefusal {
    return refuseExecution(event);
  }

  authorizeMint(event: HumanContributionEvent): MintRefusal {
    return refuseMint(event);
  }

  audit(): HumanContributionRegistryAudit {
    const records = [...this.records.values()];
    const byClass = new Map<HumanContributionRegistryRecord['contributionClass'], number>();
    const byJurisdiction = new Map<string, number>();
    const policies = new Set<string>();
    let submitted = 0;
    let verified = 0;
    let rejected = 0;
    let superseded = 0;
    let corrected = 0;
    for (const record of records) {
      byClass.set(record.contributionClass, (byClass.get(record.contributionClass) ?? 0) + 1);
      byJurisdiction.set(record.jurisdiction, (byJurisdiction.get(record.jurisdiction) ?? 0) + 1);
      if (record.verificationPolicyVersion) {
        policies.add(record.verificationPolicyVersion);
      }
      if (record.status === 'SUBMITTED' || record.status === 'VERIFICATION_REQUIRED' || record.status === 'OBSERVED') {
        submitted += 1;
      }
      if (record.status === 'VERIFIED') {
        verified += 1;
      }
      if (record.status === 'REJECTED') {
        rejected += 1;
      }
      if (record.status === 'SUPERSEDED') {
        superseded += 1;
      }
      if (record.status === 'CORRECTED') {
        corrected += 1;
      }
    }
    const countsByContributionClass: ContributionClassCount[] = [...byClass.entries()]
      .map(([contributionClass, count]) => Object.freeze({ contributionClass, count }))
      .sort((left, right) => left.contributionClass.localeCompare(right.contributionClass));
    const countsByJurisdiction: JurisdictionCount[] = [...byJurisdiction.entries()]
      .map(([jurisdiction, count]) => Object.freeze({ jurisdiction, count }))
      .sort((left, right) => left.jurisdiction.localeCompare(right.jurisdiction));
    return Object.freeze({
      submitted,
      verified,
      rejected,
      superseded,
      corrected,
      countsByContributionClass: Object.freeze(countsByContributionClass),
      countsByJurisdiction: Object.freeze(countsByJurisdiction),
      duplicateAttempts: this.duplicateAttempts.length,
      correctionCount: records.filter((record) => record.corrects !== null).length,
      verificationPolicyVersions: Object.freeze(
        [...policies].sort().map((value) => value as HumanContributionRegistryAudit['verificationPolicyVersions'][number]),
      ),
      valuationTotals: null,
      sunReyTotals: null,
    });
  }

  snapshot(): HumanContributionRegistrySnapshot {
    return Object.freeze({
      events: Object.freeze([...this.records.values()].map((record) => record.event)),
      records: Object.freeze([...this.records.values()]),
      duplicateAttempts: Object.freeze([...this.duplicateAttempts]),
      taxonomyDoesNotGrantEligibility: true,
      valuationImplemented: false,
      mintingImplemented: false,
    });
  }

  restore(snapshot: HumanContributionRegistrySnapshot): void {
    this.records.clear();
    this.duplicateAttempts.length = 0;
    const source = snapshot.records.length > 0 ? snapshot.records : snapshot.events.map((event) => registryRecordFromEvent(event));
    for (const record of source) {
      this.records.set(record.contributionId, record);
    }
    this.duplicateAttempts.push(...snapshot.duplicateAttempts);
    this.rebuildProjections();
  }

  rebuildProjections(): void {
    this.indexes.rebuild([...this.records.values()]);
    this.projectionsReady = true;
  }

  clearProjections(): void {
    this.indexes.clear();
    this.projectionsReady = false;
  }

  persist(): void {
    this.store?.persist(this.snapshot());
  }

  loadFromStore(): void {
    const loaded = this.store?.load();
    if (loaded) {
      this.restore(loaded);
    }
  }

  private insert(
    input: RecordContributionInput,
    replacing?: ContributionId,
  ): Result<HumanContributionRegistryRecord, ContributionFailure> {
    const created = createHumanContributionEvent(input);
    if (!created.ok) {
      return created;
    }
    if (this.records.has(created.value.contributionId)) {
      return err(
        failure(
          'INVALID_LIFECYCLE',
          `contribution ${created.value.contributionId} already exists; corrections are new superseding events`,
        ),
      );
    }
    const record = registryRecordFromEvent(created.value);
    const holder = this.activeHolder(record.fingerprint, replacing ?? record.contributionId);
    if (holder) {
      this.noteDuplicate(record.fingerprint, record.contributionId, created.value.createdAt);
      return err(
        failure(
          'DUPLICATE_FINGERPRINT',
          `active contribution fingerprint ${record.fingerprint} is already held by ${holder}; a correction must explicitly reference what it supersedes`,
        ),
      );
    }
    this.put(record);
    return ok(record);
  }

  private retire(
    prior: HumanContributionRegistryRecord,
    successorId: ContributionId,
    status: 'SUPERSEDED' | 'CORRECTED',
  ): void {
    const retiredEvent: HumanContributionEvent = Object.freeze({
      ...prior.event,
      status,
      dataQuality: 'SUPERSEDED',
      supersededBy: successorId,
    });
    const retired = replaceRecordEvent(prior, retiredEvent, {
      correctedBy: status === 'CORRECTED' ? successorId : prior.correctedBy,
      verifiedMeasurement: null,
    });
    this.put(retired);
  }

  private put(record: HumanContributionRegistryRecord): void {
    this.records.set(record.contributionId, record);
    this.rebuildProjections();
  }

  private activeHolder(fingerprint: ContributionFingerprint, except: ContributionId): ContributionId | undefined {
    for (const record of this.records.values()) {
      if (record.contributionId === except) {
        continue;
      }
      if (record.fingerprint === fingerprint && ACTIVE_STATUSES.has(record.status) && !record.supersededBy) {
        return record.contributionId;
      }
    }
    return undefined;
  }

  private activeVerifiedHolder(fingerprint: ContributionFingerprint, except: ContributionId): ContributionId | undefined {
    for (const record of this.records.values()) {
      if (record.contributionId === except) {
        continue;
      }
      if (record.fingerprint === fingerprint && record.status === 'VERIFIED') {
        return record.contributionId;
      }
    }
    return undefined;
  }

  private noteDuplicate(fingerprint: ContributionFingerprint, attemptedContributionId: ContributionId, at: DuplicateAttempt['at']): void {
    this.duplicateAttempts.push(
      Object.freeze({
        fingerprint,
        attemptedContributionId,
        at,
        reason: 'DUPLICATE_FINGERPRINT',
      }),
    );
  }
}

export { HumanContributionRegistry as HumanEconomicContributionRegistry };

void TERMINAL_STATUSES;
