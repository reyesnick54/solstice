import { isExpired } from '../../../config/src/clock.ts';
import type { Clock } from '../../../config/src/clock.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { EvidenceVault } from '../../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../../events/src/events.ts';
import type { DataCategory, SensitivityClass } from '../../../personal-data-vault/src/taxonomy.ts';
import {
  RECIPIENT_CORE_SERVICE,
  RECIPIENT_HIN_NETWORK,
  RECIPIENT_LICENSEE_SIM,
  RECIPIENT_PERSONAL_AGENT,
  RECIPIENT_PERSONALIZATION,
} from '../recipients.ts';
import { ConsentService, type DraftConsentInput } from '../service.ts';
import { EVIDENCE_KIND_CONSENT, type ConsentOperation } from '../taxonomy.ts';
import {
  newAccessAuditId,
  newDelegationId,
  newHinParticipationId,
  newLicenseGrantId,
  newProductGrantId,
  newRightsRequestId,
} from './ids.ts';
import {
  defaultGrantedPurposeIds,
  expandPermissionBundle,
  listProductPurposes,
  PERMISSION_BUNDLES,
  purposeById,
  type ProductPurpose,
} from './purposes.ts';
import { DataRightsStore } from './store.ts';
import {
  CURRENT_DATA_TERMS_VERSION,
  type EconomicUseClass,
  type HinParticipationState,
  type LicenseeClass,
  type PermissionBundleId,
  type ProductConsentStatus,
  type RightsRequestType,
} from './taxonomy.ts';
import type {
  AccessAuditRecord,
  AccessDecisionRequest,
  AccessDecisionResult,
  ClientReceipt,
  ConsentGrantView,
  DataRightsActor,
  DataRightsFailure,
  DataRightsRequest,
  DelegationRecord,
  HinParticipationRecord,
  LicenseGrant,
  PermissionCatalog,
  RevocationWorkflow,
  WhoCanUseView,
} from './types.ts';

const AGENT_CATEGORY_SCOPES: Readonly<Record<string, readonly string[]>> = {
  TRANSACTION_DATA: ['ANALYZE_SPENDING', 'READ_ACCOUNTS'],
  PURCHASE_HISTORY: ['ANALYZE_SPENDING'],
  PAYROLL_DATA: ['READ_ACCOUNTS', 'ANALYZE_SPENDING'],
  PREFERENCE_DATA: ['MANAGE_NON_FINANCIAL_PREFERENCES'],
};

const SENSITIVITY_RANK: Record<SensitivityClass, number> = {
  PERSONAL: 1,
  SENSITIVE: 2,
  HIGHLY_SENSITIVE: 3,
  RESTRICTED: 4,
};

export type ConsentDataRightsEngineOptions = {
  readonly clock: Clock;
  readonly consent: ConsentService;
  readonly evidence?: EvidenceVault;
  readonly events?: DomainEventLog;
  readonly store?: DataRightsStore;
  readonly currentTermsVersion?: string;
};

function recipientFor(purpose: ProductPurpose, licenseeClass?: LicenseeClass): string {
  if (licenseeClass === 'APPROVED_LICENSEE') {
    return RECIPIENT_LICENSEE_SIM;
  }
  if (purpose.family === 'AGENT_ASSISTANCE') {
    return RECIPIENT_PERSONAL_AGENT;
  }
  if (purpose.family === 'HIN_PARTICIPATION') {
    return RECIPIENT_HIN_NETWORK;
  }
  if (purpose.family === 'PERSONALIZATION') {
    return RECIPIENT_PERSONALIZATION;
  }
  if (purpose.family === 'DATA_LICENSING') {
    return RECIPIENT_LICENSEE_SIM;
  }
  return RECIPIENT_CORE_SERVICE;
}

function licenseeClassFor(purpose: ProductPurpose, requested?: LicenseeClass): LicenseeClass {
  if (requested) {
    return requested;
  }
  if (purpose.family === 'AGENT_ASSISTANCE') {
    return 'SUNREY_AGENT';
  }
  if (purpose.family === 'HIN_PARTICIPATION') {
    return 'HIN_NETWORK';
  }
  if (purpose.family === 'DATA_LICENSING') {
    return 'APPROVED_LICENSEE';
  }
  return 'FIRST_PARTY_SUNREY';
}

function rightsApplicable(type: RightsRequestType, jurisdiction: string): boolean {
  const pack = jurisdiction.toUpperCase();
  if (pack === 'GB' || pack === 'EU' || pack === 'EEA') {
    return true;
  }
  if (pack === 'US' || pack === 'CA') {
    return type !== 'OBJECTION' && type !== 'RESTRICTION';
  }
  return type === 'ACCESS' || type === 'CONSENT_WITHDRAWAL' || type === 'EXPORT';
}

function hasConsentCapability(actor: DataRightsActor, capability: string): boolean {
  if (actor.verified?.authorizedCapabilities.includes(capability as never)) {
    return true;
  }
  return actor.capabilities?.includes(capability) === true;
}

function mapLedgerStatus(state: string, now: string, expiresAt: string): ProductConsentStatus {
  if (state === 'REVOKED') return 'REVOKED';
  if (state === 'SUPERSEDED') return 'SUPERSEDED';
  if (state === 'EXPIRED' || isExpired(expiresAt as never, now as never)) return 'EXPIRED';
  if (state === 'ACTIVE') return 'ACTIVE';
  return 'SUSPENDED';
}

export class ConsentDataRightsEngine {
  private readonly clock: Clock;
  private readonly consent: ConsentService;
  private readonly evidence: EvidenceVault | undefined;
  private readonly events: DomainEventLog | undefined;
  private readonly store: DataRightsStore;
  private termsVersion: string;

  constructor(options: ConsentDataRightsEngineOptions) {
    this.clock = options.clock;
    this.consent = options.consent;
    this.evidence = options.evidence;
    this.events = options.events;
    this.store = options.store ?? new DataRightsStore();
    this.termsVersion = options.currentTermsVersion ?? CURRENT_DATA_TERMS_VERSION;
  }

  currentTermsVersion(): string {
    return this.termsVersion;
  }

  listPurposes(): readonly ProductPurpose[] {
    return listProductPurposes();
  }

  listPermissions(actor: DataRightsActor): Result<PermissionCatalog, DataRightsFailure> {
    const bound = this.requireSubject(actor, actor.subjectId, 'CONSENT_VIEW_OWN');
    if (!bound.ok) {
      return bound;
    }
    const granted = this.activeGrants(actor.subjectId);
    return ok({
      schema: 'sunrey.consumer.data.permissions.v1',
      termsVersion: this.termsVersion,
      implicitMonetizationOptIn: false,
      purposes: Object.freeze(
        listProductPurposes().map((purpose) => {
          const match = granted.find((row) => row.purposeId === purpose.purposeId);
          return Object.freeze({
            ...purpose,
            granted: match !== undefined || purpose.necessity === 'REQUIRED_FOR_CORE_SERVICE',
            consentId: match?.consentId ?? null,
          });
        }),
      ),
      bundles: Object.freeze(
        PERMISSION_BUNDLES.map((bundle) =>
          Object.freeze({
            bundleId: bundle.bundleId,
            label: bundle.label,
            description: bundle.description,
            purposeId: bundle.purposeId,
            categories: bundle.categories,
            necessity: bundle.necessity,
            granted: granted.some((row) => row.bundleId === bundle.bundleId || row.purposeId === bundle.purposeId),
          }),
        ),
      ),
    });
  }

  listConsents(actor: DataRightsActor): Result<readonly ConsentGrantView[], DataRightsFailure> {
    const bound = this.requireSubject(actor, actor.subjectId, 'CONSENT_VIEW_OWN');
    if (!bound.ok) {
      return bound;
    }
    return ok(this.store.grantsForSubject(actor.subjectId).map((row) => this.refreshGrant(row)));
  }

  grantConsent(
    actor: DataRightsActor,
    input: {
      readonly purposeId?: string;
      readonly bundleId?: string;
      readonly dataCategories?: readonly DataCategory[];
      readonly recipientClass?: LicenseeClass;
      readonly expiresAt: string;
      readonly effectiveFrom?: string;
      readonly operations?: readonly ConsentOperation[];
      readonly economicUseClass?: EconomicUseClass;
      readonly implicitOptIn?: boolean;
      readonly defaultMonetization?: boolean;
      readonly idempotencyKey: string;
      readonly sessionId?: string;
      readonly termsVersion?: string;
    },
  ): Result<ConsentGrantView, DataRightsFailure> {
    const bound = this.requireSubject(actor, actor.subjectId, 'CONSENT_GRANT_OWN');
    if (!bound.ok) {
      return bound;
    }
    if (input.implicitOptIn === true || input.defaultMonetization === true) {
      return err({
        code: 'IMPLICIT_OPT_IN_FORBIDDEN',
        message: 'optional and compensated uses cannot be granted by implicit opt-in or a silent default',
      });
    }
    const replay = this.store.grantIdempotency.get(input.idempotencyKey);
    if (replay) {
      const existing = this.store.grants.get(replay);
      if (existing) {
        return ok(existing);
      }
    }
    const bundle = input.bundleId ? expandPermissionBundle(input.bundleId) : undefined;
    if (input.bundleId && !bundle) {
      return err({ code: 'BUNDLE_UNKNOWN', message: 'permission bundle is not registered' });
    }
    const purpose = purposeById(input.purposeId ?? bundle?.purposeId ?? '');
    if (!purpose) {
      return err({ code: 'PURPOSE_UNKNOWN', message: 'purpose must be a registered product purpose' });
    }
    if (input.termsVersion && input.termsVersion !== this.termsVersion && purpose.necessity !== 'REQUIRED_FOR_CORE_SERVICE') {
      return err({
        code: 'TERMS_REQUIRE_NEW_CONSENT',
        message: 'materially broader current terms cannot be applied to an older terms version',
      });
    }
    const categories = Object.freeze([...(input.dataCategories ?? bundle?.categories ?? purpose.eligibleDataCategories)]);
    if (categories.some((category) => !purpose.eligibleDataCategories.includes(category))) {
      return err({ code: 'RESOURCE_OUT_OF_SCOPE', message: 'requested category is not eligible for this purpose' });
    }
    const economic = input.economicUseClass ?? bundle?.economicUseClass ?? purpose.economicUseClass;
    if (economic === 'ECONOMIC_LICENSING' && purpose.economicUseClass !== 'ECONOMIC_LICENSING') {
      return err({
        code: 'PURPOSE_MISMATCH',
        message: 'economic licensing is a separate purpose and is not implied by personalization or research',
      });
    }
    if (purpose.necessity === 'OPTIONAL_COMPENSATED' && economic !== 'ECONOMIC_LICENSING') {
      return err({
        code: 'PURPOSE_MISMATCH',
        message: 'compensated licensing requires explicit ECONOMIC_LICENSING scope',
      });
    }
    const ledgerPurpose = this.consent.purposesRegistry().resolve(purpose.ledgerCode);
    const operations = Object.freeze([
      ...(input.operations ?? bundle?.operations ?? ledgerPurpose?.allowedOperations ?? (['READ'] as const)),
    ]);
    const derivationTypes =
      operations.includes('AGGREGATE') && !operations.includes('READ')
        ? (['AGGREGATE_ONLY'] as const)
        : operations.includes('DERIVE') && !operations.includes('READ')
          ? (['DERIVED_ONLY'] as const)
          : operations.includes('CONTRIBUTE')
            ? (['AGGREGATE_ONLY'] as const)
            : (['RAW', 'DERIVED_ONLY'] as const);
    const verified = actor.verified;
    if (!verified) {
      return err({ code: 'ACTOR_CONTEXT_REQUIRED', message: 'consent grant requires a verified ActorContext' });
    }
    const draftInput: DraftConsentInput = {
      subjectId: actor.subjectId,
      recipientId: recipientFor(purpose, input.recipientClass),
      purposeRef: purpose.ledgerCode,
      categories,
      operations,
      derivationTypes,
      effectiveFrom: (input.effectiveFrom ?? this.clock.now()) as DraftConsentInput['effectiveFrom'],
      expiresAt: input.expiresAt as DraftConsentInput['expiresAt'],
      idempotencyKey: input.idempotencyKey,
    };
    const draft = this.consent.draftConsent(verified, draftInput);
    if (!draft.ok) {
      return draft;
    }
    const confirmed = this.consent.confirmConsent(verified, draft.value.consentId, `confirm:${input.idempotencyKey}`);
    if (!confirmed.ok) {
      return confirmed;
    }
    const receipt = this.consent.getConsentReceipt(verified, confirmed.value.consentId);
    const now = this.clock.now();
    const grant: ConsentGrantView = Object.freeze({
      grantId: newProductGrantId(),
      consentId: confirmed.value.consentId,
      receiptId: receipt.ok ? receipt.value.receiptId : null,
      subjectId: actor.subjectId,
      purposeId: purpose.purposeId,
      purpose: purpose.description,
      ledgerCode: purpose.ledgerCode,
      purposeVersion: confirmed.value.purposeVersion,
      dataCategories: categories,
      recipientClass: licenseeClassFor(purpose, input.recipientClass),
      recipientId: confirmed.value.recipientId,
      scope: {
        operations,
        assetIds: confirmed.value.permittedAssetIds,
        windowFrom: confirmed.value.scope.windowFrom,
        windowTo: confirmed.value.scope.windowTo,
      },
      grantedAt: now,
      expiresAt: confirmed.value.expiresAt,
      revocable: purpose.necessity !== 'REQUIRED_FOR_CORE_SERVICE',
      termsVersion: this.termsVersion,
      status: 'ACTIVE',
      source: { kind: bundle ? 'BUNDLE' : input.sessionId ? 'SESSION' : 'API', sessionId: input.sessionId ?? null },
      necessity: purpose.necessity,
      economicUseClass: economic,
      bundleId: (bundle?.bundleId ?? null) as PermissionBundleId | null,
      evidenceRef: confirmed.value.evidenceRef,
    });
    this.store.grants.set(grant.grantId, grant);
    this.store.grantIdempotency.set(input.idempotencyKey, grant.grantId);
    this.emit('ConsentGranted', grant.consentId, {
      consentId: grant.consentId,
      purposeId: grant.purposeId,
      termsVersion: grant.termsVersion,
    });
    this.seal('product.granted', { consentId: grant.consentId, purposeId: grant.purposeId, termsVersion: grant.termsVersion });
    return ok(grant);
  }

  revokeConsent(
    actor: DataRightsActor,
    consentId: string,
    reason: string,
    idempotencyKey: string,
  ): Result<{ readonly revocation: RevocationWorkflow; readonly grant: ConsentGrantView }, DataRightsFailure> {
    const bound = this.requireSubject(actor, actor.subjectId, 'CONSENT_REVOKE_OWN');
    if (!bound.ok) {
      return bound;
    }
    const grant = this.store.grantsForSubject(actor.subjectId).find((row) => row.consentId === consentId || row.grantId === consentId);
    if (!grant) {
      return err({ code: 'NO_ACTIVE_CONSENT', message: 'consent not found' });
    }
    if (!grant.revocable && grant.necessity === 'REQUIRED_FOR_CORE_SERVICE') {
      return err({
        code: 'CONSENT_NOT_ACTIVE',
        message: 'core-service processing cannot be revoked as an optional permission; use a data-rights request',
      });
    }
    const verified = actor.verified;
    if (!verified) {
      return err({ code: 'ACTOR_CONTEXT_REQUIRED', message: 'revocation requires a verified ActorContext' });
    }
    const revoked = this.consent.revokeConsent(verified, grant.consentId, reason, idempotencyKey);
    if (!revoked.ok) {
      return revoked;
    }
    const updated: ConsentGrantView = Object.freeze({ ...grant, status: 'REVOKED' });
    this.store.grants.set(grant.grantId, updated);
    this.store.revokedPermits.add(grant.consentId);
    let licensingStopped = false;
    for (const license of this.store.licensesForSubject(actor.subjectId)) {
      if (license.purposeId === grant.purposeId && license.status === 'ACTIVE') {
        this.store.licenses.set(license.licenseId, Object.freeze({ ...license, status: 'REVOKED' }));
        licensingStopped = true;
      }
    }
    const agentAccessUpdated = grant.purposeId === 'agent-assistance';
    let hinEligibilityUpdated = false;
    if (grant.purposeId === 'hin-participation' || grant.purposeId === 'data-licensing') {
      const hin = this.store.hin.get(actor.subjectId);
      if (hin && hin.state === 'ENROLLED') {
        this.store.hin.set(actor.subjectId, Object.freeze({ ...hin, state: 'RESTRICTED', updatedAt: this.clock.now() }));
        hinEligibilityUpdated = true;
      }
    }
    const workflow: RevocationWorkflow = Object.freeze({
      consentId: grant.consentId,
      disabledAccess: true,
      invalidatedPermissions: true,
      licensingStopped,
      agentAccessUpdated,
      hinEligibilityUpdated,
      notifiedSystems: Object.freeze([
        'consent-ledger',
        'purpose-firewall',
        ...(licensingStopped ? ['licensee-access'] : []),
        ...(agentAccessUpdated ? ['agent-access'] : []),
        ...(hinEligibilityUpdated ? ['hin-participation'] : []),
      ]),
      historicalProcessingErased: false,
    });
    this.emit('ConsentRevoked', grant.consentId, {
      consentId: grant.consentId,
      purposeId: grant.purposeId,
      historicalProcessingErased: false,
    });
    this.seal('product.revoked', { consentId: grant.consentId, purposeId: grant.purposeId });
    return ok({ revocation: workflow, grant: updated });
  }

  mayAccessData(request: AccessDecisionRequest): AccessDecisionResult {
    const result = this.evaluateAccess(request);
    this.recordAudit(request, result);
    return result;
  }

  evaluateAgentAccess(input: {
    readonly actor: DataRightsActor;
    readonly subjectId: string;
    readonly category: DataCategory;
    readonly purposeId?: string;
    readonly requestedOperation: ConsentOperation;
    readonly mandate: NonNullable<AccessDecisionRequest['agentMandate']>;
  }): AccessDecisionResult {
    return this.mayAccessData({
      actor: { ...input.actor, originatedFromAgent: true },
      subjectId: input.subjectId,
      category: input.category,
      purposeId: input.purposeId ?? 'agent-assistance',
      requestedOperation: input.requestedOperation,
      actorKind: 'AGENT',
      agentMandate: input.mandate,
    });
  }

  createLicense(
    actor: DataRightsActor,
    input: {
      readonly licenseeId: string;
      readonly purposeId: string;
      readonly categories: readonly DataCategory[];
      readonly queryLimit: number;
      readonly windowFrom: string;
      readonly windowTo: string;
      readonly privacyRequirements: readonly string[];
    },
  ): Result<LicenseGrant, DataRightsFailure> {
    const bound = this.requireSubject(actor, actor.subjectId, 'CONSENT_GRANT_OWN');
    if (!bound.ok) {
      return bound;
    }
    const purpose = purposeById(input.purposeId);
    if (!purpose || !purpose.shareable) {
      return err({ code: 'LICENSE_DENIED', message: 'purpose is not shareable with a third-party licensee' });
    }
    const consent = this.activeGrants(actor.subjectId).find((row) => row.purposeId === purpose.purposeId);
    if (!consent) {
      return err({ code: 'NO_ACTIVE_CONSENT', message: 'licensee access requires an active shareable consent' });
    }
    const license: LicenseGrant = Object.freeze({
      licenseId: newLicenseGrantId(),
      subjectId: actor.subjectId,
      licenseeId: input.licenseeId,
      licenseeClass: 'APPROVED_LICENSEE',
      purposeId: purpose.purposeId,
      categories: Object.freeze([...input.categories]),
      queryLimit: input.queryLimit,
      queriesUsed: 0,
      windowFrom: input.windowFrom as LicenseGrant['windowFrom'],
      windowTo: input.windowTo as LicenseGrant['windowTo'],
      privacyRequirements: Object.freeze([...input.privacyRequirements]),
      termsVersion: this.termsVersion,
      status: 'ACTIVE',
      unrestrictedDatabaseAccess: false,
    });
    this.store.licenses.set(license.licenseId, license);
    return ok(license);
  }

  submitRightsRequest(
    actor: DataRightsActor,
    input: { readonly type: RightsRequestType; readonly idempotencyKey: string; readonly jurisdiction?: string },
  ): Result<DataRightsRequest, DataRightsFailure> {
    const bound = this.requireSubject(actor, actor.subjectId, 'CONSENT_GRANT_OWN');
    if (!bound.ok) {
      return bound;
    }
    const replay = this.store.requestIdempotency.get(input.idempotencyKey);
    if (replay) {
      const existing = this.store.requests.get(replay);
      if (existing) {
        return ok(existing);
      }
    }
    const jurisdiction = input.jurisdiction ?? actor.jurisdiction ?? 'UNDECLARED';
    const applicable = rightsApplicable(input.type, jurisdiction);
    if (!applicable && input.type !== 'ACCESS' && input.type !== 'CONSENT_WITHDRAWAL') {
      return err({
        code: 'RIGHT_NOT_APPLICABLE',
        message: `right ${input.type} is not configured as applicable in jurisdiction pack ${jurisdiction}`,
      });
    }
    const now = this.clock.now();
    const needsIdentity = actor.verified?.authenticationAssurance === 'BASELINE';
    const request: DataRightsRequest = Object.freeze({
      requestId: newRightsRequestId(),
      subjectId: actor.subjectId,
      type: input.type,
      state: needsIdentity ? 'IDENTITY_VERIFICATION_REQUIRED' : applicable ? 'SUBMITTED' : 'IN_REVIEW',
      jurisdiction,
      applicable,
      rationale: applicable
        ? 'accepted under the configured jurisdiction pack; not a legal determination that the right always applies'
        : 'held for review because the jurisdiction pack does not auto-apply this right',
      createdAt: now,
      updatedAt: now,
      evidenceRef: `${EVIDENCE_KIND_CONSENT}:rights:${input.type}`,
    });
    this.store.requests.set(request.requestId, request);
    this.store.requestIdempotency.set(input.idempotencyKey, request.requestId);
    this.emit('DataRightsRequestSubmitted', request.requestId, {
      requestId: request.requestId,
      type: request.type,
      state: request.state,
    });
    if (input.type === 'CONSENT_WITHDRAWAL') {
      for (const grant of this.activeGrants(actor.subjectId).filter((row) => row.revocable)) {
        if (actor.verified) {
          this.revokeConsent(actor, grant.consentId, 'consent withdrawal request', `withdraw:${grant.consentId}`);
        }
      }
    }
    return ok(request);
  }

  advanceRightsRequest(
    actor: DataRightsActor,
    requestId: string,
    state: DataRightsRequest['state'],
    rationale: string,
  ): Result<DataRightsRequest, DataRightsFailure> {
    const current = this.store.requests.get(requestId);
    if (!current || current.subjectId !== actor.subjectId) {
      return err({ code: 'NO_ACTIVE_CONSENT', message: 'rights request not found' });
    }
    const next: DataRightsRequest = Object.freeze({
      ...current,
      state,
      rationale,
      updatedAt: this.clock.now(),
    });
    this.store.requests.set(requestId, next);
    return ok(next);
  }

  listRightsRequests(actor: DataRightsActor): Result<readonly DataRightsRequest[], DataRightsFailure> {
    const bound = this.requireSubject(actor, actor.subjectId, 'CONSENT_VIEW_OWN');
    if (!bound.ok) {
      return bound;
    }
    return ok(this.store.requestsForSubject(actor.subjectId));
  }

  getHinParticipation(actor: DataRightsActor): Result<HinParticipationRecord, DataRightsFailure> {
    const bound = this.requireSubject(actor, actor.subjectId, 'CONSENT_VIEW_OWN');
    if (!bound.ok) {
      return bound;
    }
    return ok(this.hinOf(actor.subjectId));
  }

  enrollHin(
    actor: DataRightsActor,
    input: { readonly categories?: readonly DataCategory[]; readonly expiresAt: string; readonly idempotencyKey: string },
  ): Result<HinParticipationRecord, DataRightsFailure> {
    const granted = this.grantConsent(actor, {
      purposeId: 'hin-participation',
      dataCategories: input.categories,
      expiresAt: input.expiresAt,
      idempotencyKey: input.idempotencyKey,
      recipientClass: 'HIN_NETWORK',
    });
    if (!granted.ok) {
      return granted;
    }
    const record: HinParticipationRecord = Object.freeze({
      participationId: this.store.hin.get(actor.subjectId)?.participationId ?? newHinParticipationId(),
      subjectId: actor.subjectId,
      state: 'ENROLLED',
      eligibleCategories: granted.value.dataCategories,
      eligiblePurposeIds: Object.freeze(['hin-participation']),
      financialServicesRemainOpen: true,
      updatedAt: this.clock.now(),
    });
    this.store.hin.set(actor.subjectId, record);
    this.emit('HinParticipationChanged', actor.subjectId, { state: 'ENROLLED', financialServicesRemainOpen: true });
    return ok(record);
  }

  pauseHin(actor: DataRightsActor): Result<HinParticipationRecord, DataRightsFailure> {
    return this.transitionHin(actor, 'PAUSED');
  }

  withdrawHin(actor: DataRightsActor): Result<HinParticipationRecord, DataRightsFailure> {
    const hin = this.hinOf(actor.subjectId);
    if (hin.state === 'NOT_ENROLLED') {
      return err({ code: 'HIN_STATE_INVALID', message: 'subject is not enrolled in optional HIN participation' });
    }
    for (const grant of this.activeGrants(actor.subjectId).filter((row) => row.purposeId === 'hin-participation')) {
      this.revokeConsent(actor, grant.consentId, 'HIN withdrawal', `hin-withdraw:${grant.consentId}`);
    }
    const record: HinParticipationRecord = Object.freeze({
      ...hin,
      state: 'WITHDRAWN',
      eligibleCategories: Object.freeze([]),
      eligiblePurposeIds: Object.freeze([]),
      financialServicesRemainOpen: true,
      updatedAt: this.clock.now(),
    });
    this.store.hin.set(actor.subjectId, record);
    this.emit('HinParticipationChanged', actor.subjectId, {
      state: 'WITHDRAWN',
      financialServicesRemainOpen: true,
      ordinaryFinancialServicesClosed: false,
    });
    return ok(record);
  }

  createDelegation(
    actor: DataRightsActor,
    input: {
      readonly delegateActorId: string;
      readonly relationship: DelegationRecord['relationship'];
      readonly categories: readonly DataCategory[];
      readonly purposeIds: readonly string[];
      readonly operations: readonly ConsentOperation[];
      readonly explicitSensitive?: boolean;
    },
  ): Result<DelegationRecord, DataRightsFailure> {
    const bound = this.requireSubject(actor, actor.subjectId, 'CONSENT_GRANT_OWN');
    if (!bound.ok) {
      return bound;
    }
    if (input.categories.length === 0 || input.purposeIds.length === 0) {
      return err({ code: 'DELEGATION_TOO_BROAD', message: 'delegation must name categories and purposes; blanket access is forbidden' });
    }
    const sensitive = input.categories.some((category) => category === 'PAYROLL_DATA' || category === 'LOCATION_SUMMARY');
    if (sensitive && input.explicitSensitive !== true) {
      return err({
        code: 'DELEGATION_TOO_BROAD',
        message: 'sensitive categories require an explicit sensitive-scope acknowledgement',
      });
    }
    const record: DelegationRecord = Object.freeze({
      delegationId: newDelegationId(),
      subjectId: actor.subjectId,
      delegateActorId: input.delegateActorId,
      relationship: input.relationship,
      categories: Object.freeze([...input.categories]),
      purposeIds: Object.freeze([...input.purposeIds]),
      operations: Object.freeze([...input.operations]),
      explicitSensitive: input.explicitSensitive === true,
      status: 'ACTIVE',
      createdAt: this.clock.now(),
    });
    this.store.delegations.set(record.delegationId, record);
    return ok(record);
  }

  listAccessHistory(actor: DataRightsActor): Result<readonly AccessAuditRecord[], DataRightsFailure> {
    const bound = this.requireSubject(actor, actor.subjectId, 'CONSENT_VIEW_OWN');
    if (!bound.ok) {
      return bound;
    }
    return ok(this.store.auditForSubject(actor.subjectId));
  }

  whoCanUse(actor: DataRightsActor): Result<WhoCanUseView, DataRightsFailure> {
    const listed = this.listConsents(actor);
    if (!listed.ok) {
      return listed;
    }
    const classes: LicenseeClass[] = ['FIRST_PARTY_SUNREY', 'SUNREY_AGENT', 'HIN_NETWORK', 'APPROVED_LICENSEE', 'DELEGATE'];
    return ok({
      schema: 'sunrey.consumer.data.who.v1',
      items: Object.freeze(
        classes.map((recipientClass) => {
          const rows = listed.value.filter((row) => row.recipientClass === recipientClass && row.status === 'ACTIVE');
          return Object.freeze({
            recipientClass,
            label: recipientClass,
            purposeIds: Object.freeze(rows.map((row) => row.purposeId)),
            status: rows.length > 0 ? ('ACTIVE' as const) : ('NONE' as const),
          });
        }),
      ),
    });
  }

  receiptFor(actor: DataRightsActor, consentId: string): Result<ClientReceipt, DataRightsFailure> {
    const grant = this.store.grantsForSubject(actor.subjectId).find((row) => row.consentId === consentId);
    if (!grant) {
      return err({ code: 'NO_ACTIVE_CONSENT', message: 'receipt not found' });
    }
    const bound = this.requireSubject(actor, grant.subjectId, 'CONSENT_VIEW_OWN');
    if (!bound.ok) {
      return bound;
    }
    return ok({
      receiptId: grant.receiptId ?? `ref:${grant.consentId}`,
      consentId: grant.consentId,
      purposeId: grant.purposeId,
      termsVersion: grant.termsVersion,
      timestamp: grant.grantedAt,
      actorId: actor.actorId,
      scope: {
        categories: grant.dataCategories,
        recipientClass: grant.recipientClass,
        operations: grant.scope.operations,
      },
      rawPayloadIncluded: false,
    });
  }

  advanceTerms(nextVersion: string, broadenedPurposeIds: readonly string[]): void {
    this.termsVersion = nextVersion;
    for (const grant of this.store.grants.values()) {
      if (broadenedPurposeIds.includes(grant.purposeId) && grant.status === 'ACTIVE') {
        this.store.grants.set(
          grant.grantId,
          Object.freeze({
            ...grant,
            status: 'SUSPENDED',
          }),
        );
      }
    }
  }

  defaultPurposeIds(): readonly string[] {
    return defaultGrantedPurposeIds();
  }

  consentService(): ConsentService {
    return this.consent;
  }

  private evaluateAccess(request: AccessDecisionRequest): AccessDecisionResult {
    const purpose = purposeById(request.purposeId);
    const base = {
      purposeId: request.purposeId,
      category: request.category,
      consentId: null as string | null,
      mandateSatisfied: request.actorKind === 'AGENT' ? false : null,
      consentSatisfied: null as boolean | null,
      resourceRef: request.recordId ?? null,
    };
    if (!purpose) {
      return { decision: 'DENY', reasonCode: 'PURPOSE_UNKNOWN', reason: 'purpose is not registered', ...base };
    }
    if (request.actor.subjectId !== request.subjectId && request.actorKind === 'SUBJECT') {
      return { decision: 'DENY', reasonCode: 'CROSS_SUBJECT_DENIED', reason: 'actor is not bound to the subject', ...base };
    }
    if (request.retentionState === 'DELETED') {
      return { decision: 'DENY', reasonCode: 'RESOURCE_OUT_OF_SCOPE', reason: 'record is deleted', ...base };
    }
    if (request.classification === 'RESTRICTED' && request.actorKind !== 'SUBJECT' && request.actorKind !== 'FIRST_PARTY_SERVICE') {
      return { decision: 'REQUIRE_REVIEW', reasonCode: 'LEGAL_BASIS_UNCERTAIN', reason: 'restricted classification requires review', ...base };
    }
    if (!purpose.eligibleDataCategories.includes(request.category)) {
      return { decision: 'DENY', reasonCode: 'RESOURCE_OUT_OF_SCOPE', reason: 'category is not eligible for this purpose', ...base };
    }
    if (purpose.necessity === 'REQUIRED_FOR_CORE_SERVICE' && (request.actorKind === 'SUBJECT' || request.actorKind === 'FIRST_PARTY_SERVICE')) {
      return {
        decision: 'ALLOW',
        reasonCode: 'ALLOWED',
        reason: 'core-service necessity; not an optional monetization grant',
        ...base,
        consentSatisfied: true,
      };
    }
    if (request.actorKind === 'LICENSEE') {
      const license = request.licenseId ? this.store.licenses.get(request.licenseId) : undefined;
      if (!license || license.status !== 'ACTIVE' || license.subjectId !== request.subjectId) {
        return { decision: 'DENY', reasonCode: 'LICENSE_DENIED', reason: 'no active scoped licensee grant; database access is never unrestricted', ...base };
      }
      if (license.purposeId !== request.purposeId || !license.categories.includes(request.category)) {
        return { decision: 'DENY', reasonCode: 'LICENSE_DENIED', reason: 'license scope does not include this purpose or category', ...base };
      }
      if (license.queriesUsed >= license.queryLimit) {
        return { decision: 'DENY', reasonCode: 'LICENSE_DENIED', reason: 'license query limit exhausted', ...base };
      }
      this.store.licenses.set(license.licenseId, Object.freeze({ ...license, queriesUsed: license.queriesUsed + 1 }));
    }
    if (request.actorKind === 'DELEGATE') {
      const delegation = request.delegationId ? this.store.delegations.get(request.delegationId) : undefined;
      if (!delegation || delegation.status !== 'ACTIVE' || delegation.delegateActorId !== request.actor.actorId) {
        return { decision: 'DENY', reasonCode: 'CAPABILITY_DENIED', reason: 'delegate is not authorized for this subject', ...base };
      }
      if (!delegation.categories.includes(request.category) || !delegation.purposeIds.includes(request.purposeId)) {
        return { decision: 'DENY', reasonCode: 'RESOURCE_OUT_OF_SCOPE', reason: 'delegation does not include this category or purpose', ...base };
      }
    }
    let mandateSatisfied: boolean | null = request.actorKind === 'AGENT' ? false : null;
    if (request.actorKind === 'AGENT') {
      const mandate = request.agentMandate;
      if (!mandate || mandate.state !== 'ACTIVE') {
        return { decision: 'DENY', reasonCode: 'CAPABILITY_DENIED', reason: 'Agent mandate is missing or not active', ...base };
      }
      const needed = AGENT_CATEGORY_SCOPES[request.category] ?? [];
      const scopeOk =
        needed.length === 0 ||
        needed.some((scope) => mandate.assistScopes.includes(scope)) ||
        mandate.actionClasses.includes('READ_FINANCIAL_STATE');
      if (!scopeOk) {
        return {
          decision: 'DENY',
          reasonCode: 'CAPABILITY_DENIED',
          reason: 'Agent mandate does not include this data class',
          ...base,
          mandateSatisfied: false,
        };
      }
      mandateSatisfied = true;
    }
    const candidates = this.store
      .grantsForSubject(request.subjectId)
      .map((row) => this.refreshGrant(row))
      .filter(
        (row) =>
          row.purposeId === request.purposeId &&
          row.dataCategories.includes(request.category) &&
          row.scope.operations.includes(request.requestedOperation),
      );
    const suspended = candidates.find((row) => row.status === 'SUSPENDED');
    if (suspended && suspended.termsVersion !== this.termsVersion) {
      return {
        decision: 'REQUIRE_CONSENT',
        reasonCode: 'TERMS_REQUIRE_NEW_CONSENT',
        reason: 'current terms are materially broader; the legacy grant is not silently expanded',
        ...base,
        consentId: suspended.consentId,
        mandateSatisfied,
        consentSatisfied: false,
      };
    }
    const grant = candidates.find((row) => row.status === 'ACTIVE');
    if (!grant) {
      if (request.actorKind === 'AGENT' && mandateSatisfied) {
        return {
          decision: 'REQUIRE_CONSENT',
          reasonCode: 'NO_ACTIVE_CONSENT',
          reason: 'Agent mandate is present but optional vault consent is missing',
          ...base,
          mandateSatisfied: true,
          consentSatisfied: false,
        };
      }
      if (purpose.necessity === 'OPTIONAL' || purpose.necessity === 'OPTIONAL_COMPENSATED') {
        return {
          decision: 'REQUIRE_CONSENT',
          reasonCode: 'NO_ACTIVE_CONSENT',
          reason: 'optional purpose requires an explicit active grant',
          ...base,
          mandateSatisfied,
          consentSatisfied: false,
        };
      }
      return { decision: 'DENY', reasonCode: 'NO_ACTIVE_CONSENT', reason: 'no active consent', ...base, mandateSatisfied };
    }
    if (grant.termsVersion !== this.termsVersion && purpose.necessity !== 'REQUIRED_FOR_CORE_SERVICE') {
      return {
        decision: 'REQUIRE_CONSENT',
        reasonCode: 'TERMS_REQUIRE_NEW_CONSENT',
        reason: 'current terms are materially broader; the legacy grant is not silently expanded',
        ...base,
        consentId: grant.consentId,
        mandateSatisfied,
        consentSatisfied: false,
      };
    }
    if (purpose.legalHook === 'COUNSEL_REVIEW_REQUIRED' && request.requestedOperation === 'SHARE') {
      return {
        decision: 'REQUIRE_REVIEW',
        reasonCode: 'LEGAL_BASIS_UNCERTAIN',
        reason: 'sharing under this purpose requires review; not a compliance claim',
        ...base,
        consentId: grant.consentId,
        mandateSatisfied,
        consentSatisfied: true,
      };
    }
    if (request.actorKind === 'LICENSEE' && grant.economicUseClass !== 'ECONOMIC_LICENSING' && purpose.family === 'DATA_LICENSING') {
      return {
        decision: 'DENY',
        reasonCode: 'PURPOSE_MISMATCH',
        reason: 'licensee use requires explicit economic-licensing consent',
        ...base,
        consentId: grant.consentId,
        mandateSatisfied,
        consentSatisfied: false,
      };
    }
    return {
      decision: 'ALLOW',
      reasonCode: 'ALLOWED',
      reason: 'purpose, consent, and actor constraints satisfied',
      ...base,
      consentId: grant.consentId,
      mandateSatisfied,
      consentSatisfied: true,
    };
  }

  private activeGrants(subjectId: string): readonly ConsentGrantView[] {
    return this.store.grantsForSubject(subjectId).map((row) => this.refreshGrant(row)).filter((row) => row.status === 'ACTIVE');
  }

  private refreshGrant(grant: ConsentGrantView): ConsentGrantView {
    if (grant.status === 'ACTIVE' && isExpired(grant.expiresAt, this.clock.now())) {
      const expired = Object.freeze({ ...grant, status: 'EXPIRED' as const });
      this.store.grants.set(grant.grantId, expired);
      return expired;
    }
    return grant;
  }

  private hinOf(subjectId: string): HinParticipationRecord {
    return (
      this.store.hin.get(subjectId) ??
      Object.freeze({
        participationId: newHinParticipationId(),
        subjectId,
        state: 'NOT_ENROLLED' as const,
        eligibleCategories: Object.freeze([]),
        eligiblePurposeIds: Object.freeze([]),
        financialServicesRemainOpen: true,
        updatedAt: this.clock.now(),
      })
    );
  }

  private transitionHin(actor: DataRightsActor, state: HinParticipationState): Result<HinParticipationRecord, DataRightsFailure> {
    const bound = this.requireSubject(actor, actor.subjectId, 'CONSENT_GRANT_OWN');
    if (!bound.ok) {
      return bound;
    }
    const current = this.hinOf(actor.subjectId);
    if (current.state === 'NOT_ENROLLED' || current.state === 'WITHDRAWN') {
      return err({ code: 'HIN_STATE_INVALID', message: `cannot move HIN participation from ${current.state} to ${state}` });
    }
    const next: HinParticipationRecord = Object.freeze({
      ...current,
      state,
      financialServicesRemainOpen: true,
      updatedAt: this.clock.now(),
    });
    this.store.hin.set(actor.subjectId, next);
    this.emit('HinParticipationChanged', actor.subjectId, { state, financialServicesRemainOpen: true });
    return ok(next);
  }

  private recordAudit(request: AccessDecisionRequest, result: AccessDecisionResult): void {
    const row: AccessAuditRecord = Object.freeze({
      auditId: newAccessAuditId(),
      actorId: request.actor.actorId,
      subjectId: request.subjectId,
      purposeId: request.purposeId,
      category: request.category,
      timestamp: this.clock.now(),
      decision: result.decision,
      resourceRef: request.recordId ?? null,
      rawValueLogged: false,
    });
    this.store.audit.push(row);
    this.seal('product.access', {
      actorId: row.actorId,
      subjectId: row.subjectId,
      purposeId: row.purposeId,
      category: row.category,
      decision: row.decision,
      resourceRef: row.resourceRef,
    });
  }

  private requireSubject(
    actor: DataRightsActor,
    subjectId: string,
    capability: string,
  ): Result<DataRightsActor, DataRightsFailure> {
    if (actor.subjectId !== subjectId) {
      return err({ code: 'SUBJECT_MISMATCH', message: 'data-rights APIs are subject-bound' });
    }
    if (!hasConsentCapability(actor, capability) && !hasConsentCapability(actor, 'CONSENT_VIEW_OWN') && !actor.verified) {
      return err({ code: 'CAPABILITY_DENIED', message: `${capability} is required` });
    }
    if (actor.verified && actor.verified.subjectId !== subjectId) {
      return err({ code: 'SUBJECT_MISMATCH', message: 'verified actor is not bound to the subject' });
    }
    return ok(actor);
  }

  private emit(eventType: string, aggregateId: string, payload: Record<string, unknown>): void {
    this.events?.append({
      eventType: eventType as never,
      schemaVersion: 1,
      occurredAt: this.clock.now(),
      payload,
      aggregateType: 'consent',
      aggregateId,
    } as never);
  }

  private seal(kind: string, payload: Record<string, unknown>): void {
    this.evidence?.seal(`${EVIDENCE_KIND_CONSENT}:${kind}`, {
      ...payload,
      kind,
      simulation: true,
      plaintextIncluded: false,
    });
  }
}

export { CURRENT_DATA_TERMS_VERSION };
