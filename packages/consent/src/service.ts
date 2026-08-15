import { isExpired } from '../../config/src/clock.ts';
import type { Clock } from '../../config/src/clock.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../events/src/events.ts';
import { assuranceAtLeast } from '../../identity/src/assurance.ts';
import { isVerifiedActorContext, type VerifiedActorContext } from '../../identity/src/actor-context.ts';
import { requiredAssuranceFor, type IdentityCapability } from '../../identity/src/capability.ts';
import type { DataCategory } from '../../personal-data-vault/src/taxonomy.ts';
import type { KeyProvider } from '../../security/src/provider.ts';
import { sha256Hex } from '../../security/src/hash.ts';
import { PurposeFirewall, type FirewallRequest } from './firewall.ts';
import {
  asConsentId,
  asConsentRevocationId,
  newConsentDecisionId,
  newConsentGrantId,
  newConsentId,
  newConsentReceiptId,
  newConsentRevocationId,
  newConsentVersion,
  newDataScopeId,
} from './ids.ts';
import { ConsentLedger } from './ledger.ts';
import { issueDataUsePermit, verifyDataUsePermit } from './permit.ts';
import { PurposeRegistry } from './purpose-registry.ts';
import { RecipientRegistry } from './recipients.ts';
import { ConsentStore } from './store.ts';
import {
  canTransition,
  EVIDENCE_KIND_CONSENT,
  FORBIDDEN_WILDCARDS,
  MAX_CONSENT_TTL_MS,
  type ConsentOperation,
  type ConsentReasonCode,
  type DerivationType,
} from './taxonomy.ts';
import type {
  ConsentDecision,
  ConsentFailure,
  ConsentReceipt,
  ConsentRecord,
  ConsentRevocation,
  ConsentScope,
  ConsentStoreSnapshot,
  DataUsePermit,
  PurposeRecord,
} from './types.ts';

export const CONSENT_GRANT_CAPABILITY: IdentityCapability = 'CONSENT_GRANT_OWN';
export const CONSENT_REVOKE_CAPABILITY: IdentityCapability = 'CONSENT_REVOKE_OWN';
export const CONSENT_VIEW_CAPABILITY: IdentityCapability = 'CONSENT_VIEW_OWN';

export type ConsentServiceOptions = {
  readonly clock: Clock;
  readonly keys: KeyProvider;
  readonly evidence: EvidenceVault;
  readonly events: DomainEventLog;
  readonly store?: ConsentStore;
};

export type DraftConsentInput = {
  readonly subjectId: string;
  readonly recipientId: string;
  readonly purposeRef: string;
  readonly categories: readonly DataCategory[];
  readonly assetIds?: readonly string[];
  readonly fields?: readonly string[];
  readonly windowFrom?: UtcInstant;
  readonly windowTo?: UtcInstant;
  readonly operations: readonly ConsentOperation[];
  readonly derivationTypes: readonly DerivationType[];
  readonly effectiveFrom: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly requestedRetentionDays?: number;
  readonly jurisdiction?: string;
  readonly idempotencyKey: string;
  readonly supersedesConsentId?: string;
};

export type PermitRequest = {
  readonly subjectId: string;
  readonly recipientId: string;
  readonly purposeRef: string;
  readonly resourceId: string;
  readonly category?: DataCategory;
  readonly fields?: readonly string[];
  readonly windowFrom?: UtcInstant;
  readonly windowTo?: UtcInstant;
  readonly operation: ConsentOperation;
  readonly derivationType: DerivationType;
  readonly onwardSharing?: boolean;
  readonly requestedRetentionDays?: number;
  readonly sensitivity?: import('../../personal-data-vault/src/taxonomy.ts').SensitivityClass;
};

function hasCapability(actor: VerifiedActorContext, capability: IdentityCapability): boolean {
  return actor.authorizedCapabilities.includes(capability);
}

function rejectWildcards(input: DraftConsentInput): ConsentFailure | null {
  const tokens = [
    ...input.categories,
    ...input.operations,
    ...(input.assetIds ?? []),
    input.purposeRef,
    input.expiresAt,
  ];
  for (const token of tokens) {
    if (FORBIDDEN_WILDCARDS.includes(String(token))) {
      return { code: 'WILDCARD_GRANT_FORBIDDEN', message: `${token} is not a permitted default grant` };
    }
  }
  if (input.categories.length === 0 && (input.assetIds ?? []).length === 0) {
    return { code: 'WILDCARD_GRANT_FORBIDDEN', message: 'consent must name categories or specific assets; unlimited grants are not the default' };
  }
  if (input.operations.length === 0) {
    return { code: 'WILDCARD_GRANT_FORBIDDEN', message: 'consent must name operations' };
  }
  return null;
}

export class ConsentService {
  private readonly clock: Clock;
  private readonly keys: KeyProvider;
  private readonly evidence: EvidenceVault;
  private readonly events: DomainEventLog;
  private readonly store: ConsentStore;
  private readonly ledger: ConsentLedger;
  private readonly purposes: PurposeRegistry;
  private readonly recipients: RecipientRegistry;
  private readonly firewall = new PurposeFirewall();

  constructor(options: ConsentServiceOptions) {
    this.clock = options.clock;
    this.keys = options.keys;
    this.evidence = options.evidence;
    this.events = options.events;
    this.store = options.store ?? new ConsentStore();
    this.ledger = new ConsentLedger(this.store);
    this.purposes = new PurposeRegistry();
    this.recipients = new RecipientRegistry();
    for (const purpose of this.purposes.list()) {
      this.store.putPurpose(purpose);
    }
    for (const recipient of this.recipients.list()) {
      this.store.putRecipient(recipient);
    }
  }

  draftConsent(actor: unknown, input: DraftConsentInput): Result<ConsentRecord, ConsentFailure> {
    const verified = this.requireActor(actor, input.subjectId, CONSENT_GRANT_CAPABILITY);
    if (!verified.ok) {
      return verified;
    }
    const existing = this.store.grantForKey(input.idempotencyKey);
    if (existing) {
      const current = this.store.currentForId(existing);
      if (current) {
        return ok(current);
      }
    }
    const wild = rejectWildcards(input);
    if (wild) {
      return err(wild);
    }
    const purpose = this.purposes.resolve(input.purposeRef);
    if (!purpose || purpose.status !== 'ACTIVE') {
      return err({ code: 'PURPOSE_UNKNOWN', message: 'purpose must be a registered versioned purpose' });
    }
    const recipient = this.recipients.get(input.recipientId);
    if (!recipient) {
      return err({ code: 'RECIPIENT_OUT_OF_SCOPE', message: 'recipient is not in the simulation registry' });
    }
    const ttl = Date.parse(input.expiresAt) - Date.parse(input.effectiveFrom);
    if (!Number.isFinite(ttl) || ttl <= 0 || ttl > MAX_CONSENT_TTL_MS) {
      return err({ code: 'WILDCARD_GRANT_FORBIDDEN', message: 'consent must have a finite expiration; indefinite grants are forbidden' });
    }
    if (purpose.maxSensitivity === 'HIGHLY_SENSITIVE' || purpose.maxSensitivity === 'RESTRICTED') {
      if (!assuranceAtLeast(verified.value.authenticationAssurance, 'STRONG')) {
        return err({ code: 'ASSURANCE_INSUFFICIENT', message: 'high-sensitivity consent requires stronger assurance' });
      }
    }
    const now = this.clock.now();
    const consentId = input.supersedesConsentId ? asConsentId(input.supersedesConsentId) : newConsentId();
    const prior = input.supersedesConsentId ? this.store.currentForId(input.supersedesConsentId) : undefined;
    const sequence = (prior?.versionSequence ?? 0) + 1;
    const version = newConsentVersion(consentId, sequence);
    const scope: ConsentScope = Object.freeze({
      scopeId: newDataScopeId(),
      assetIds: Object.freeze([...(input.assetIds ?? [])]),
      categories: Object.freeze([...input.categories]),
      fields: Object.freeze([...(input.fields ?? [])]),
      windowFrom: input.windowFrom ?? null,
      windowTo: input.windowTo ?? null,
      operations: Object.freeze([...input.operations]),
      derivationTypes: Object.freeze([...input.derivationTypes]),
    });
    const record: ConsentRecord = Object.freeze({
      consentId,
      grantId: newConsentGrantId(),
      subjectId: input.subjectId,
      version,
      versionSequence: sequence,
      recipientId: recipient.recipientId,
      purposeId: purpose.purposeId,
      purposeVersion: purpose.purposeVersion,
      purposeCode: purpose.code,
      scope,
      permittedOperations: scope.operations,
      permittedCategories: scope.categories,
      permittedAssetIds: scope.assetIds,
      permittedDerivationTypes: scope.derivationTypes,
      effectiveFrom: input.effectiveFrom,
      expiresAt: input.expiresAt,
      retention: {
        requestedRetentionDays: input.requestedRetentionDays ?? purpose.retentionExpectationDays,
        reference: 'consent.declared_retention',
        statutoryClaim: false,
      },
      onwardSharing: {
        state: 'NOT_ALLOWED',
        recipientClass: null,
        purposeId: null,
        purposeVersion: null,
        constraints: Object.freeze([]),
      },
      jurisdiction: input.jurisdiction ?? null,
      confirmation: null,
      createdAt: now,
      state: 'DRAFT',
      supersedes: prior?.version ?? null,
      policyId: this.purposes.policyIdFor(purpose),
      sourceRef: 'packages/consent',
      evidenceRef: '',
      legalHook: purpose.legalHook,
      revision: 1,
    });
    this.store.putRecord(record);
    this.store.rememberGrant(input.idempotencyKey, consentId);
    this.ledger.append({
      consentId,
      version,
      kind: 'DRAFT_CREATED',
      occurredAt: now,
      payload: { subjectId: input.subjectId, purposeCode: purpose.code, recipientId: recipient.recipientId },
    });
    this.emit('ConsentDraftCreated', consentId, { consentId, subjectId: input.subjectId, purposeCode: purpose.code });
    this.seal('draft.created', { consentId, subjectId: input.subjectId, purposeVersion: purpose.purposeVersion });
    return ok(record);
  }

  confirmConsent(actor: unknown, consentId: string, idempotencyKey: string): Result<ConsentRecord, ConsentFailure> {
    const current = this.store.currentForId(consentId);
    if (!current) {
      return err({ code: 'NO_ACTIVE_CONSENT', message: 'consent not found' });
    }
    const verified = this.requireActor(actor, current.subjectId, CONSENT_GRANT_CAPABILITY);
    if (!verified.ok) {
      return verified;
    }
    const replay = this.store.grantForKey(idempotencyKey);
    if (replay) {
      const existing = this.store.currentForId(replay);
      if (existing && existing.state === 'ACTIVE') {
        return ok(existing);
      }
    }
    if (!canTransition(current.state, 'AWAITING_CONFIRMATION') && current.state !== 'AWAITING_CONFIRMATION') {
      return err({ code: 'CONSENT_NOT_ACTIVE', message: `cannot confirm consent in state ${current.state}` });
    }
    const awaiting = this.transition(current, 'AWAITING_CONFIRMATION');
    const now = this.clock.now();
    const hash = sha256Hex(JSON.stringify({
      consentId: awaiting.consentId,
      version: awaiting.version,
      purposeVersion: awaiting.purposeVersion,
      scope: awaiting.scope,
      expiresAt: awaiting.expiresAt,
    }));
    const confirmed: ConsentRecord = Object.freeze({
      ...awaiting,
      state: 'ACTIVE',
      confirmation: {
        subjectId: awaiting.subjectId,
        actorId: verified.value.actorId,
        authenticationAssurance: verified.value.authenticationAssurance,
        confirmedAt: now,
        consentVersion: awaiting.version,
        consentHash: hash,
      },
      evidenceRef: `${EVIDENCE_KIND_CONSENT}:${awaiting.consentId}:${awaiting.version}`,
      revision: awaiting.revision + 1,
    });
    if (confirmed.supersedes) {
      const prior = this.store.getVersion(confirmed.consentId, confirmed.supersedes);
      if (prior && prior.state === 'ACTIVE') {
        this.store.putRecord(this.transition(prior, 'SUPERSEDED'));
        this.ledger.append({
          consentId: prior.consentId,
          version: prior.version,
          kind: 'SUPERSEDED',
          occurredAt: now,
          payload: { successor: confirmed.version },
        });
        this.emit('ConsentSuperseded', prior.consentId, { consentId: prior.consentId, version: prior.version });
      }
    }
    this.store.putRecord(confirmed);
    this.store.rememberGrant(idempotencyKey, confirmed.consentId);
    const receipt: ConsentReceipt = Object.freeze({
      receiptId: newConsentReceiptId(),
      consentId: confirmed.consentId,
      version: confirmed.version,
      subjectId: confirmed.subjectId,
      recipientId: confirmed.recipientId,
      purposeId: confirmed.purposeId,
      purposeVersion: confirmed.purposeVersion,
      purposeCode: confirmed.purposeCode,
      categories: confirmed.permittedCategories,
      assetIds: confirmed.permittedAssetIds,
      operations: confirmed.permittedOperations,
      derivationTypes: confirmed.permittedDerivationTypes,
      effectiveFrom: confirmed.effectiveFrom,
      expiresAt: confirmed.expiresAt,
      onwardSharing: confirmed.onwardSharing.state,
      confirmedAt: now,
      consentHash: hash,
      immutable: true,
    });
    this.store.putReceipt(receipt);
    this.ledger.append({
      consentId: confirmed.consentId,
      version: confirmed.version,
      kind: 'GRANTED',
      occurredAt: now,
      payload: { subjectId: confirmed.subjectId, purposeCode: confirmed.purposeCode, receiptId: receipt.receiptId },
    });
    this.emit('ConsentGranted', confirmed.consentId, {
      consentId: confirmed.consentId,
      version: confirmed.version,
      purposeCode: confirmed.purposeCode,
    });
    this.seal('granted', {
      consentId: confirmed.consentId,
      version: confirmed.version,
      purposeVersion: confirmed.purposeVersion,
      subjectId: confirmed.subjectId,
    });
    return ok(confirmed);
  }

  revokeConsent(
    actor: unknown,
    consentId: string,
    reason: string,
    idempotencyKey: string,
  ): Result<ConsentRevocation, ConsentFailure> {
    const current = this.store.currentForId(consentId);
    if (!current) {
      return err({ code: 'NO_ACTIVE_CONSENT', message: 'consent not found' });
    }
    const verified = this.requireActor(actor, current.subjectId, CONSENT_REVOKE_CAPABILITY);
    if (!verified.ok) {
      return verified;
    }
    this.store.acquire(current.consentId);
    const replay = this.store.revokeForKey(idempotencyKey);
    if (replay) {
      return ok({
        revocationId: asConsentRevocationId(replay),
        consentId: current.consentId,
        version: current.version,
        subjectId: current.subjectId,
        revokedAt: this.clock.now(),
        reason,
        downstreamObligation: 'NOTIFY_DEPENDENTS_ONLY',
        erasesDeliveredThirdPartyData: false,
      });
    }
    if (current.state === 'REVOKED') {
      const revocationId = newConsentRevocationId();
      this.store.rememberRevoke(idempotencyKey, revocationId);
      return ok({
        revocationId,
        consentId: current.consentId,
        version: current.version,
        subjectId: current.subjectId,
        revokedAt: this.clock.now(),
        reason,
        downstreamObligation: 'NOTIFY_DEPENDENTS_ONLY',
        erasesDeliveredThirdPartyData: false,
      });
    }
    if (!canTransition(current.state, 'REVOKED')) {
      return err({ code: 'CONSENT_NOT_ACTIVE', message: `cannot revoke consent in state ${current.state}` });
    }
    const now = this.clock.now();
    const revoked = Object.freeze({ ...this.transition(current, 'REVOKED'), revision: current.revision + 1 });
    this.store.putRecord(revoked);
    const revocation: ConsentRevocation = Object.freeze({
      revocationId: newConsentRevocationId(),
      consentId: revoked.consentId,
      version: revoked.version,
      subjectId: revoked.subjectId,
      revokedAt: now,
      reason,
      downstreamObligation: 'NOTIFY_DEPENDENTS_ONLY',
      erasesDeliveredThirdPartyData: false,
    });
    this.store.putRevocation(revocation);
    this.store.rememberRevoke(idempotencyKey, revocation.revocationId);
    this.ledger.append({
      consentId: revoked.consentId,
      version: revoked.version,
      kind: 'REVOKED',
      occurredAt: now,
      payload: { subjectId: revoked.subjectId, revocationId: revocation.revocationId },
    });
    this.emit('ConsentRevoked', revoked.consentId, {
      consentId: revoked.consentId,
      version: revoked.version,
      notification: 'consent.revoked',
    });
    this.seal('revoked', { consentId: revoked.consentId, version: revoked.version, subjectId: revoked.subjectId });
    return ok(revocation);
  }

  issuePermit(actor: unknown, request: PermitRequest): Result<{ readonly permit: DataUsePermit; readonly decision: ConsentDecision }, ConsentFailure> {
    const verified = this.requireActor(actor, request.subjectId, CONSENT_VIEW_CAPABILITY);
    if (!verified.ok) {
      return this.deny(actor, request, verified.error.code, verified.error.message, null);
    }
    const purpose = this.purposes.resolve(request.purposeRef);
    if (!purpose) {
      return this.deny(actor, request, 'PURPOSE_UNKNOWN', 'requested purpose is not registered', null);
    }
    const recipient = this.recipients.get(request.recipientId);
    if (!recipient) {
      return this.deny(actor, request, 'RECIPIENT_OUT_OF_SCOPE', 'recipient is not registered', null);
    }
    const now = this.clock.now();
    const candidates = this.store.allForSubject(request.subjectId).map((row) => this.expireIfNeeded(row, now));
    for (const row of candidates) {
      this.store.acquire(row.consentId);
    }
    const firewallRequest: FirewallRequest = {
      subjectId: request.subjectId,
      actorSubjectId: verified.value.subjectId,
      actorAssurance: verified.value.authenticationAssurance,
      recipient,
      purpose,
      resourceId: request.resourceId,
      category: request.category ?? null,
      fields: request.fields ?? [],
      windowFrom: request.windowFrom ?? null,
      windowTo: request.windowTo ?? null,
      operation: request.operation,
      derivationType: request.derivationType,
      onwardSharing: request.onwardSharing === true,
      requestedRetentionDays: request.requestedRetentionDays ?? null,
      sensitivity: request.sensitivity ?? null,
      now,
    };
    const result = this.firewall.evaluate(firewallRequest, candidates);
    if (result.decision !== 'ALLOW' || !result.consent) {
      return this.deny(actor, request, result.reasonCode, result.reason, result.consent);
    }
    const permit = issueDataUsePermit({
      keys: this.keys,
      consent: result.consent,
      operation: request.operation,
      now,
    });
    if (!permit.ok) {
      return this.deny(actor, request, permit.error.code, permit.error.message, result.consent);
    }
    this.store.putPermit(permit.value);
    const decision = this.recordDecision({
      decision: 'ALLOW',
      reasonCode: 'ALLOWED',
      reason: result.reason,
      subjectId: request.subjectId,
      purpose,
      consent: result.consent,
      permitId: permit.value.permitId,
      actorId: verified.value.actorId,
      recipientId: recipient.recipientId,
      resourceId: request.resourceId,
      operation: request.operation,
    });
    this.ledger.append({
      consentId: result.consent.consentId,
      version: result.consent.version,
      kind: 'PERMIT_ISSUED',
      occurredAt: now,
      payload: { permitId: permit.value.permitId, operation: request.operation },
    });
    this.emit('ConsentPermitIssued', result.consent.consentId, {
      consentId: result.consent.consentId,
      permitId: permit.value.permitId,
      purposeCode: purpose.code,
    });
    this.seal('permit.issued', {
      consentId: result.consent.consentId,
      permitId: permit.value.permitId,
      purposeVersion: purpose.purposeVersion,
      subjectId: request.subjectId,
    });
    return ok({ permit: permit.value, decision });
  }

  verifyPermit(
    permit: DataUsePermit,
    expected: { readonly subjectId: string; readonly recipientId: string; readonly purposeId: string },
  ): Result<DataUsePermit, ConsentFailure> {
    const current = this.store.currentForId(permit.consentId);
    if (!current || current.state === 'REVOKED') {
      return err({ code: 'CONSENT_REVOKED', message: 'permit is bound to revoked consent' });
    }
    if (current.state === 'EXPIRED' || isExpired(current.expiresAt, this.clock.now())) {
      return err({ code: 'CONSENT_EXPIRED', message: 'permit is bound to expired consent' });
    }
    return verifyDataUsePermit({
      keys: this.keys,
      permit,
      now: this.clock.now(),
      expectedRecipientId: expected.recipientId,
      expectedPurposeId: expected.purposeId,
      expectedSubjectId: expected.subjectId,
    });
  }

  executeExternalContribution(actor: unknown, consentId: string): Result<never, ConsentFailure> {
    const current = this.store.currentForId(consentId);
    if (!current) {
      return err({ code: 'NO_ACTIVE_CONSENT', message: 'consent not found' });
    }
    const verified = this.requireActor(actor, current.subjectId, CONSENT_VIEW_CAPABILITY);
    if (!verified.ok) {
      return verified;
    }
    return err({
      code: 'DEPENDENCY_NOT_IMPLEMENTED',
      message: 'Clean Room is not implemented; consent cannot cause raw external data transfer',
    });
  }

  listMyConsents(actor: unknown, subjectId: string): Result<readonly ConsentRecord[], ConsentFailure> {
    const verified = this.requireActor(actor, subjectId, CONSENT_VIEW_CAPABILITY);
    if (!verified.ok) {
      return verified;
    }
    return ok(this.store.listForSubject(subjectId).map((row) => this.expireIfNeeded(row, this.clock.now())));
  }

  listActiveConsents(actor: unknown, subjectId: string): Result<readonly ConsentRecord[], ConsentFailure> {
    const verified = this.requireActor(actor, subjectId, CONSENT_VIEW_CAPABILITY);
    if (!verified.ok) {
      return verified;
    }
    const now = this.clock.now();
    const active = this.store
      .allForSubject(subjectId)
      .map((row) => this.expireIfNeeded(row, now))
      .filter((row) => row.state === 'ACTIVE');
    return ok(Object.freeze(active));
  }

  listRevokedConsents(actor: unknown, subjectId: string): Result<readonly ConsentRecord[], ConsentFailure> {
    const listed = this.listMyConsents(actor, subjectId);
    if (!listed.ok) {
      return listed;
    }
    return ok(Object.freeze(listed.value.filter((row) => row.state === 'REVOKED')));
  }

  getConsent(actor: unknown, consentId: string): Result<ConsentRecord, ConsentFailure> {
    const current = this.store.currentForId(consentId);
    if (!current) {
      return err({ code: 'NO_ACTIVE_CONSENT', message: 'consent not found' });
    }
    const verified = this.requireActor(actor, current.subjectId, CONSENT_VIEW_CAPABILITY);
    if (!verified.ok) {
      return verified;
    }
    return ok(this.expireIfNeeded(current, this.clock.now()));
  }

  getConsentReceipt(actor: unknown, consentId: string): Result<ConsentReceipt, ConsentFailure> {
    const current = this.getConsent(actor, consentId);
    if (!current.ok) {
      return current;
    }
    const receipt = this.store.receiptForConsent(current.value.consentId, current.value.version);
    if (!receipt) {
      return err({ code: 'NO_ACTIVE_CONSENT', message: 'receipt not found' });
    }
    return ok(receipt);
  }

  listDataUsesForConsent(actor: unknown, consentId: string): Result<readonly ConsentDecision[], ConsentFailure> {
    const current = this.getConsent(actor, consentId);
    if (!current.ok) {
      return current;
    }
    return ok(this.store.decisionsForConsent(current.value.consentId));
  }

  getPurposeDescription(purposeRef: string): Result<PurposeRecord, ConsentFailure> {
    const purpose = this.purposes.resolve(purposeRef);
    if (!purpose) {
      return err({ code: 'PURPOSE_UNKNOWN', message: 'purpose is not registered' });
    }
    return ok(purpose);
  }

  versionPurposeMeaning(
    currentCode: string,
    next: Omit<PurposeRecord, 'purposeId' | 'purposeVersion' | 'versionNumber' | 'code'>,
  ): PurposeRecord {
    const current = this.purposes.resolve(currentCode);
    if (!current) {
      throw new Error('purpose not found');
    }
    const created = this.purposes.versionPurpose(current, next);
    this.store.putPurpose({ ...current, status: 'SUPERSEDED' });
    this.store.putPurpose(created);
    this.ledger.append({
      consentId: asConsentId('cns_purpose_registry'),
      version: newConsentVersion(asConsentId('cns_purpose_registry'), created.versionNumber),
      kind: 'PURPOSE_VERSIONED',
      occurredAt: this.clock.now(),
      payload: { purposeId: created.purposeId, purposeVersion: created.purposeVersion },
    });
    this.emit('ConsentPurposeVersioned', created.purposeId, {
      purposeId: created.purposeId,
      purposeVersion: created.purposeVersion,
    });
    return created;
  }

  ledgerVerifies(): boolean {
    return this.ledger.verify();
  }

  snapshot(): ConsentStoreSnapshot {
    return this.store.snapshot();
  }

  restore(state: ConsentStoreSnapshot): void {
    this.store.restore(state);
  }

  purposesRegistry(): PurposeRegistry {
    return this.purposes;
  }

  recipientsRegistry(): RecipientRegistry {
    return this.recipients;
  }

  private expireIfNeeded(record: ConsentRecord, now: UtcInstant): ConsentRecord {
    if (record.state === 'ACTIVE' && isExpired(record.expiresAt, now)) {
      const expired = this.transition(record, 'EXPIRED');
      this.store.putRecord(expired);
      this.ledger.append({
        consentId: expired.consentId,
        version: expired.version,
        kind: 'EXPIRED',
        occurredAt: now,
        payload: { subjectId: expired.subjectId },
      });
      this.emit('ConsentExpired', expired.consentId, { consentId: expired.consentId, version: expired.version });
      return expired;
    }
    return record;
  }

  private transition(record: ConsentRecord, state: ConsentRecord['state']): ConsentRecord {
    if (record.state !== state && !canTransition(record.state, state)) {
      throw new Error(`illegal consent transition ${record.state} -> ${state}`);
    }
    return Object.freeze({ ...record, state });
  }

  private requireActor(
    actor: unknown,
    subjectId: string,
    capability: IdentityCapability,
  ): Result<VerifiedActorContext, ConsentFailure> {
    if (!isVerifiedActorContext(actor)) {
      return err({ code: 'ACTOR_CONTEXT_REQUIRED', message: 'consent requires a verified ActorContext bound to the subject' });
    }
    if (actor.subjectId !== subjectId) {
      return err({ code: 'SUBJECT_MISMATCH', message: 'consent APIs are subject-bound' });
    }
    if (!hasCapability(actor, capability)) {
      return err({ code: 'CAPABILITY_DENIED', message: `${capability} is required` });
    }
    if (!assuranceAtLeast(actor.authenticationAssurance, requiredAssuranceFor(capability))) {
      return err({ code: 'ASSURANCE_INSUFFICIENT', message: `${capability} requires stronger authentication` });
    }
    return ok(actor);
  }

  private deny(
    actor: unknown,
    request: PermitRequest,
    reasonCode: ConsentReasonCode,
    reason: string,
    consent: ConsentRecord | null,
  ): Result<never, ConsentFailure> {
    const actorId = typeof actor === 'object' && actor !== null && 'actorId' in actor
      ? String((actor as { actorId: string }).actorId)
      : 'unknown';
    const purpose = this.purposes.resolve(request.purposeRef);
    this.recordDecision({
      decision: 'DENY',
      reasonCode,
      reason,
      subjectId: request.subjectId,
      purpose: purpose ?? null,
      consent,
      permitId: null,
      actorId,
      recipientId: this.recipients.get(request.recipientId)?.recipientId ?? null,
      resourceId: request.resourceId,
      operation: request.operation,
    });
    this.emit('ConsentAccessDenied', request.resourceId, {
      subjectId: request.subjectId,
      reasonCode,
      purposeRef: request.purposeRef,
    });
    this.seal('access.denied', { subjectId: request.subjectId, reasonCode, resourceId: request.resourceId });
    return err({ code: reasonCode, message: reason });
  }

  private recordDecision(input: {
    readonly decision: 'ALLOW' | 'DENY' | 'REVIEW_REQUIRED';
    readonly reasonCode: ConsentReasonCode;
    readonly reason: string;
    readonly subjectId: string;
    readonly purpose: PurposeRecord | null;
    readonly consent: ConsentRecord | null;
    readonly permitId: DataUsePermit['permitId'] | null;
    readonly actorId: string;
    readonly recipientId: ConsentRecord['recipientId'] | null;
    readonly resourceId: string;
    readonly operation: ConsentOperation | null;
  }): ConsentDecision {
    const decision: ConsentDecision = Object.freeze({
      decisionId: newConsentDecisionId(),
      decision: input.decision,
      reasonCode: input.reasonCode,
      reason: input.reason,
      subjectId: input.subjectId,
      purposeId: input.purpose?.purposeId ?? null,
      purposeVersion: input.purpose?.purposeVersion ?? null,
      consentId: input.consent?.consentId ?? null,
      consentVersion: input.consent?.version ?? null,
      permitId: input.permitId,
      actorId: input.actorId,
      recipientId: input.recipientId,
      resourceId: input.resourceId,
      operation: input.operation,
      occurredAt: this.clock.now(),
    });
    this.store.putDecision(decision);
    return decision;
  }

  private emit(eventType: string, aggregateId: string, payload: Record<string, unknown>): void {
    this.events.append({
      eventType: eventType as never,
      schemaVersion: 1,
      occurredAt: this.clock.now(),
      payload,
      aggregateType: 'consent',
      aggregateId,
    } as never);
  }

  private seal(kind: string, payload: Record<string, unknown>): void {
    this.evidence.seal(`${EVIDENCE_KIND_CONSENT}:${kind}`, {
      ...payload,
      kind,
      simulation: true,
      plaintextIncluded: false,
    });
  }
}
