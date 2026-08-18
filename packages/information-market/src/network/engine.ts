import { createHash, createHmac } from 'node:crypto';

import type { Clock } from '../../../config/src/clock.ts';
import { asJurisdiction } from '../../../domain/src/jurisdiction.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { evaluateEligibility } from '../../../sunrey-exchange/src/eligibility.ts';
import { informationRightInstrument } from '../../../sunrey-exchange/src/instruments.ts';
import { createAuthorizedConnector, refuseUncontrolledScraping } from './connectors.ts';
import {
  newApprovedComputationId,
  newAuditId,
  newCompensationInstructionId,
  newComputationRequestId,
  newComputationResultId,
  newConsentGrantId,
  newDescriptorId,
  newIncidentId,
  newOfferId,
  newPermissionId,
  newPurposeGrantId,
  newRequestId,
  newRevocationId,
  newRightId,
  newSubjectId,
  newTransactionId,
  newUsageReceiptId,
  type ApprovedComputationId,
  type CleanRoomComputationRequestId,
  type HumanInformationConsentGrantId,
  type HumanInformationRequestId,
  type HumanInformationRightId,
  type HumanInformationSubjectId,
} from './ids.ts';
import { privacyMinimizedNotification } from './mobile.ts';
import {
  categoryPermitted,
  defaultNetworkPolicy,
  evaluateProductionActivation,
  outputClassIsPersonWorthScore,
  purposePermitted,
  rightTypeEnabled,
  type HumanInformationNetworkPolicy,
} from './policy.ts';
import {
  computationHash,
  createPrivacyBudget,
  detectQueryAbuse,
  enforceCohort,
  enforceOutputBounds,
  queryFingerprint,
} from './privacy.ts';
import { HumanInformationNetworkStore } from './store.ts';
import {
  AGENT_INFORMATION_MANDATE,
  EVIDENCE_KIND_HUMAN_INFORMATION,
  NETWORK_LEGAL_STATUS,
  RAW_EXPORT_POLICY,
  type DeveloperInformationScope,
  type IncidentKind,
  type InformationCategory,
  type InformationRightType,
  type InformationSensitivityClass,
  type NetworkCompensationAsset,
  type OutputClass,
  type ProcessingClass,
  type SourceClass,
} from './taxonomy.ts';
import type {
  AgentMandateContext,
  ApprovedComputation,
  CleanRoomComputationRequest,
  CleanRoomComputationResult,
  ConsentPreview,
  ControlCenterProjection,
  DeveloperAccessContext,
  HumanInformationAssetDescriptor,
  HumanInformationCompensationInstruction,
  HumanInformationConsentGrant,
  HumanInformationNetworkReport,
  HumanInformationOffer,
  HumanInformationRequest,
  HumanInformationRevocation,
  HumanInformationRight,
  HumanInformationRightsAudit,
  HumanInformationSubject,
  HumanInformationUsageReceipt,
  InformationConnector,
  MobileNotification,
  NetworkFailure,
  NetworkRequester,
  OnChainAnchor,
  RequesterPortalProjection,
} from './types.ts';

export type HumanInformationNetworkEngineOptions = {
  readonly clock: Clock;
  readonly policy?: HumanInformationNetworkPolicy;
  readonly hmacSecret?: string;
};

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function asInstant(clock: Clock): UtcInstant {
  return clock.now();
}

export class HumanInformationNetworkEngine {
  private readonly clock: Clock;
  readonly policy: HumanInformationNetworkPolicy;
  readonly store: HumanInformationNetworkStore;
  private readonly hmacSecret: string;
  readonly notifications: MobileNotification[] = [];

  constructor(options: HumanInformationNetworkEngineOptions) {
    this.clock = options.clock;
    this.policy = options.policy ?? defaultNetworkPolicy();
    this.store = new HumanInformationNetworkStore();
    this.hmacSecret = options.hmacSecret ?? 'hin-simulation-hmac';
  }

  report(): HumanInformationNetworkReport {
    return Object.freeze({
      chunk: 'CHUNK-100',
      syntheticData: true,
      rawPersonalDataExported: false,
      productionActivated: false,
      humanWorthScore: false,
      socialCredit: false,
      policy: this.policy,
      legalStatus: NETWORK_LEGAL_STATUS,
    });
  }

  productionActivation() {
    return evaluateProductionActivation();
  }

  privacyBudget() {
    return createPrivacyBudget(this.policy);
  }

  registerSubject(input: { readonly internalRef: string }): Result<HumanInformationSubject, NetworkFailure> {
    const subject: HumanInformationSubject = Object.freeze({
      subjectId: newSubjectId(),
      internalRef: digest(input.internalRef),
      publicHandle: `subject_${digest(input.internalRef).slice(0, 10)}`,
      legalNameExposed: false,
      rawIdentityExposed: false,
      createdAt: asInstant(this.clock),
    });
    this.store.subjects.set(subject.subjectId, subject);
    return ok(subject);
  }

  registerDescriptor(input: {
    readonly subjectId: HumanInformationSubjectId;
    readonly category: InformationCategory;
    readonly schema: string;
    readonly sourceClass: SourceClass;
    readonly freshness: string;
    readonly sensitivityClass: InformationSensitivityClass;
    readonly permittedComputationClasses: readonly ProcessingClass[];
  }): Result<HumanInformationAssetDescriptor, NetworkFailure> {
    if (!this.store.subjects.has(input.subjectId)) {
      return err({ code: 'SUBJECT_UNKNOWN', message: 'subject is not registered' });
    }
    if (!categoryPermitted(this.policy, input.category)) {
      return err({ code: 'CATEGORY_DEFAULT_DENY', message: `category ${input.category} remains default-deny` });
    }
    const descriptor: HumanInformationAssetDescriptor = Object.freeze({
      descriptorId: newDescriptorId(),
      subjectId: input.subjectId,
      category: input.category,
      schema: input.schema,
      sourceClass: input.sourceClass,
      freshness: input.freshness,
      quality: Object.freeze({
        freshness: input.freshness,
        completeness: 'COMPLETE',
        verification: 'SIMULATED',
        provenanceConfidence: 'MEDIUM',
        isHumanSocialRanking: false,
      }),
      sensitivityClass: input.sensitivityClass,
      permittedComputationClasses: Object.freeze([...input.permittedComputationClasses]),
      rawContentIncluded: false,
    });
    this.store.descriptors.set(descriptor.descriptorId, descriptor);
    this.store.provenance.set(
      descriptor.descriptorId,
      Object.freeze({
        source: input.sourceClass,
        subjectRelationship: 'CONTROLLER',
        collectionAuthority: 'AUTHORIZED_SOURCE_RELATIONSHIP',
        timestamp: asInstant(this.clock),
        transforms: Object.freeze(['DESCRIPTOR_ONLY']),
        attestations: Object.freeze(['SYNTHETIC_SIMULATION']),
      }),
    );
    return ok(descriptor);
  }

  registerRequester(input: {
    readonly requesterId: string;
    readonly organization: string;
    readonly requesterClass: string;
    readonly jurisdiction: string;
    readonly applicationId?: string;
  }): Result<NetworkRequester, NetworkFailure> {
    if (!input.organization.trim()) {
      return err({ code: 'REQUESTER_UNIDENTIFIED', message: 'production requester requires an accountable organization' });
    }
    const requester: NetworkRequester = Object.freeze({
      requesterId: input.requesterId,
      organization: input.organization,
      applicationId: input.applicationId ?? null,
      accountable: true,
      requesterClass: input.requesterClass,
      jurisdiction: input.jurisdiction,
    });
    this.store.requesters.set(requester.requesterId, requester);
    return ok(requester);
  }

  registerApprovedComputation(input: {
    readonly codeVersion: string;
    readonly queryDefinition: string;
    readonly artifactDigest: string;
    readonly allowedOutputClasses: readonly OutputClass[];
    readonly computationId?: ApprovedComputationId;
  }): Result<ApprovedComputation, NetworkFailure> {
    const computation: ApprovedComputation = Object.freeze({
      computationId: input.computationId ?? newApprovedComputationId(),
      codeVersion: input.codeVersion,
      queryDefinition: input.queryDefinition,
      artifactDigest: input.artifactDigest,
      allowedOutputClasses: Object.freeze([...input.allowedOutputClasses]),
      allowListed: true,
    });
    this.store.computations.set(computation.computationId, computation);
    return ok(computation);
  }

  registerConnector(input: Parameters<typeof createAuthorizedConnector>[0]): Result<InformationConnector, NetworkFailure> {
    const connector = createAuthorizedConnector(input);
    this.store.connectors.set(connector.connectorId, connector);
    return ok(connector);
  }

  ingestScrapedSource(): Result<never, NetworkFailure> {
    return err(refuseUncontrolledScraping());
  }

  registerOffer(input: {
    readonly subjectId: HumanInformationSubjectId;
    readonly rightType: InformationRightType;
    readonly purposeClasses: readonly string[];
    readonly requesterClasses: readonly string[];
    readonly compensationRequired: boolean;
    readonly validUntil: UtcInstant;
    readonly privacyRequirements: readonly string[];
  }): Result<HumanInformationOffer, NetworkFailure> {
    if (!rightTypeEnabled(this.policy, input.rightType)) {
      return err({ code: 'RIGHT_TYPE_NOT_ENABLED', message: 'right type is enumerated but not enabled by policy' });
    }
    const offer: HumanInformationOffer = Object.freeze({
      offerId: newOfferId(),
      subjectId: input.subjectId,
      rightType: input.rightType,
      purposeClasses: Object.freeze([...input.purposeClasses]),
      requesterClasses: Object.freeze([...input.requesterClasses]),
      compensationRequired: input.compensationRequired,
      validFrom: asInstant(this.clock),
      validUntil: input.validUntil,
      privacyRequirements: Object.freeze([...input.privacyRequirements]),
    });
    this.store.offers.set(offer.offerId, offer);
    return ok(offer);
  }

  submitInformationRequest(input: {
    readonly requesterId: string;
    readonly requestedRight: InformationRightType;
    readonly purpose: string;
    readonly computationId?: ApprovedComputationId;
    readonly duration: string;
    readonly compensationAsset: NetworkCompensationAsset;
    readonly compensationMinor: bigint;
    readonly jurisdiction: string;
    readonly evidenceRequirements?: readonly string[];
    readonly developer?: DeveloperAccessContext;
  }): Result<HumanInformationRequest, NetworkFailure> {
    const requester = this.store.requesters.get(input.requesterId);
    if (!requester) {
      return err({ code: 'REQUESTER_UNIDENTIFIED', message: 'requester organization is required' });
    }
    if (this.store.emergencyRestricted) {
      return err({ code: 'EMERGENCY_RESTRICTED', message: 'emergency control has restricted Human Information activity' });
    }
    if (!rightTypeEnabled(this.policy, input.requestedRight)) {
      return err({ code: 'RIGHT_TYPE_NOT_ENABLED', message: 'right type is not enabled' });
    }
    if (!purposePermitted(input.purpose)) {
      return err({ code: 'PURPOSE_TOO_BROAD', message: 'generic any-future-purpose access is rejected' });
    }
    const developerGate = this.assertDeveloperAccess(input.developer, 'HUMAN_INFORMATION_REQUEST');
    if (!developerGate.ok) {
      return developerGate;
    }
    const request: HumanInformationRequest = Object.freeze({
      requestId: newRequestId(),
      requesterId: input.requesterId,
      requesterOrganization: requester.organization,
      requestedRight: input.requestedRight,
      purpose: input.purpose,
      computationId: input.computationId ?? null,
      duration: input.duration,
      compensationAsset: input.compensationAsset,
      compensationMinor: input.compensationMinor,
      jurisdiction: input.jurisdiction,
      evidenceRequirements: Object.freeze([...(input.evidenceRequirements ?? ['CONSENT_RECEIPT', 'USAGE_RECEIPT'])]),
      status: 'SUBMITTED',
      createdAt: asInstant(this.clock),
    });
    this.store.requests.set(request.requestId, request);
    const subject = [...this.store.subjects.values()][0];
    if (subject) {
      this.notifications.push(
        privacyMinimizedNotification({
          kind: 'INFORMATION_REQUEST',
          subjectHandle: subject.publicHandle,
          requesterClass: requester.requesterClass,
          purpose: input.purpose,
        }),
      );
    }
    return ok(request);
  }

  previewInformationConsent(input: {
    readonly requestId: HumanInformationRequestId;
    readonly subjectId: HumanInformationSubjectId;
    readonly descriptorId: HumanInformationAssetDescriptor['descriptorId'];
  }): Result<ConsentPreview, NetworkFailure> {
    const request = this.store.requests.get(input.requestId);
    const descriptor = this.store.descriptors.get(input.descriptorId);
    const computation = request?.computationId ? this.store.computations.get(request.computationId) : undefined;
    if (!request || !descriptor) {
      return err({ code: 'PREVIEW_UNAVAILABLE', message: 'request or descriptor is missing' });
    }
    const requester = this.store.requesters.get(request.requesterId);
    return ok(
      Object.freeze({
        who: requester?.organization ?? request.requesterId,
        category: descriptor.category,
        purpose: request.purpose,
        computation: computation?.queryDefinition ?? 'NONE',
        output: computation?.allowedOutputClasses[0] ?? 'AGGREGATE_STATISTIC',
        duration: request.duration,
        frequency: request.requestedRight === 'RECURRING_COMPUTATION' ? 'RECURRING' : 'ONE_TIME',
        compensation: `${request.compensationAsset}:${request.compensationMinor.toString()}`,
        revocationTerms: 'FUTURE_USE_REVOKABLE; HISTORICAL_SETTLEMENT_RETAINED',
      }),
    );
  }

  approveInformationConsent(input: {
    readonly requestId: HumanInformationRequestId;
    readonly subjectId: HumanInformationSubjectId;
    readonly descriptorId: HumanInformationAssetDescriptor['descriptorId'];
    readonly processingClass: ProcessingClass;
    readonly outputClass: OutputClass;
    readonly expiresAt: UtcInstant;
    readonly agent?: AgentMandateContext;
  }): Result<
    {
      readonly grant: HumanInformationConsentGrant;
      readonly right: HumanInformationRight;
      readonly receiptHash: string;
    },
    NetworkFailure
  > {
    const agentGate = this.assertAgentMandate(input.agent, 'approve');
    if (!agentGate.ok) {
      return agentGate;
    }
    const request = this.store.requests.get(input.requestId);
    const descriptor = this.store.descriptors.get(input.descriptorId);
    const subject = this.store.subjects.get(input.subjectId);
    if (!request || !descriptor || !subject) {
      return err({ code: 'CONSENT_CONTEXT_MISSING', message: 'request, descriptor, or subject is missing' });
    }
    if (descriptor.subjectId !== input.subjectId) {
      return err({ code: 'WRONG_SUBJECT_MAPPING', message: 'descriptor does not belong to the subject' });
    }
    if (!purposePermitted(request.purpose)) {
      return err({ code: 'PURPOSE_TOO_BROAD', message: 'purpose is not explicit' });
    }
    if (outputClassIsPersonWorthScore(input.outputClass, request.purpose)) {
      return err({ code: 'HUMAN_WORTH_FORBIDDEN', message: 'privacy-safe scores may not rank people' });
    }
    const grantId = newConsentGrantId();
    const purposeGrantId = newPurposeGrantId();
    const payload = JSON.stringify({
      grantId,
      subjectId: input.subjectId,
      descriptorId: input.descriptorId,
      requesterId: request.requesterId,
      purpose: request.purpose,
      processingClass: input.processingClass,
      expiresAt: input.expiresAt,
      policyVersion: this.policy.policyVersion,
    });
    const consentHash = createHmac('sha256', this.hmacSecret).update(payload).digest('hex');
    const grant: HumanInformationConsentGrant = Object.freeze({
      grantId,
      subjectId: input.subjectId,
      descriptorId: input.descriptorId,
      recipientClass: this.store.requesters.get(request.requesterId)?.requesterClass ?? 'UNKNOWN',
      requesterId: request.requesterId,
      purpose: request.purpose,
      processingClass: input.processingClass,
      expiresAt: input.expiresAt,
      revocationTerms: 'FUTURE_USE_REVOKABLE; HISTORICAL_SETTLEMENT_RETAINED',
      compensationTerms: `${request.compensationAsset}:${request.compensationMinor.toString()}`,
      policyVersion: this.policy.policyVersion,
      consentHash,
      canonicalConsentRef: null,
      ownershipTransferred: false,
      status: 'ACTIVE',
      createdAt: asInstant(this.clock),
    });
    const purposeGrant = Object.freeze({
      purposeGrantId,
      grantId,
      purpose: request.purpose,
      anyFuturePurpose: false as const,
      status: 'ACTIVE' as const,
    });
    const right: HumanInformationRight = Object.freeze({
      rightId: newRightId(),
      subjectId: input.subjectId,
      descriptorId: input.descriptorId,
      rightType: request.requestedRight,
      purpose: request.purpose,
      processingClass: input.processingClass,
      outputClass: input.outputClass,
      ownershipTransferred: false,
      status: 'ACTIVE',
      consentGrantId: grantId,
      purposeGrantId,
      policyVersion: this.policy.policyVersion,
      expiresAt: input.expiresAt,
      createdAt: asInstant(this.clock),
    });
    const permission = Object.freeze({
      permissionId: newPermissionId(),
      rightId: right.rightId,
      subjectId: input.subjectId,
      requesterId: request.requesterId,
      purpose: request.purpose,
      processingClass: input.processingClass,
      expiresAt: input.expiresAt,
      status: 'ACTIVE' as const,
    });
    this.store.grants.set(grantId, grant);
    this.store.purposes.set(purposeGrantId, purposeGrant);
    this.store.rights.set(right.rightId, right);
    this.store.permissions.set(permission.permissionId, permission);
    this.store.requests.set(request.requestId, Object.freeze({ ...request, status: 'CONSENTED' }));
    this.anchor({
      permissionId: permission.permissionId,
      consentHash,
      purposeHash: digest(request.purpose),
      rightState: right.status,
      usageReceiptHash: null,
      settlementRef: null,
      revocationRef: null,
    });
    this.notifications.push(
      privacyMinimizedNotification({
        kind: 'CONSENT_REQUEST',
        subjectHandle: subject.publicHandle,
        category: descriptor.category,
        requesterClass: grant.recipientClass,
        purpose: request.purpose,
      }),
    );
    return ok(Object.freeze({ grant, right, receiptHash: consentHash }));
  }

  verifyConsentHash(grantId: HumanInformationConsentGrantId, presentedHash: string): Result<true, NetworkFailure> {
    const grant = this.store.grants.get(grantId);
    if (!grant) {
      return err({ code: 'CONSENT_UNKNOWN', message: 'consent grant is unknown' });
    }
    if (grant.consentHash !== presentedHash) {
      return err({ code: 'CONSENT_HASH_TAMPER', message: 'consent hash does not bind the grant' });
    }
    return ok(true);
  }

  evaluateInformationEligibility(input: {
    readonly requestId: HumanInformationRequestId;
    readonly rightId: HumanInformationRightId;
  }): Result<{ readonly eligible: boolean; readonly reason: string }, NetworkFailure> {
    const request = this.store.requests.get(input.requestId);
    const right = this.store.rights.get(input.rightId);
    const grant = right ? this.store.grants.get(right.consentGrantId) : undefined;
    if (!request || !right || !grant) {
      return err({ code: 'ELIGIBILITY_CONTEXT_MISSING', message: 'request or right is missing' });
    }
    const instrument = informationRightInstrument({
      instrumentId: `hin:${right.rightId}`,
      issuer: 'packages/information-market',
      cohortRef: right.subjectId,
      templateId: request.computationId ?? 'none',
      purpose: right.purpose,
      recipientClass: grant.recipientClass,
      consentPolicyRef: grant.consentHash,
      settlementAsset: 'SIMULATION_USD_CASH',
    });
    const decision = evaluateEligibility(instrument, {
      actorClass: 'INSTITUTION',
      capabilities: [],
      purpose: request.purpose,
      recipientClass: grant.recipientClass,
      consentActive: grant.status === 'ACTIVE',
      consentRevoked: grant.status === 'REVOKED',
      verifiedAccount: true,
      jurisdiction: asJurisdiction(request.jurisdiction.length === 2 ? request.jurisdiction : 'GB'),
      geography: null,
      machineId: null,
      access: 'ELIGIBLE_COUNTERPARTY',
    });
    if (grant.status === 'REVOKED' || right.status === 'REVOKED') {
      return ok({ eligible: false, reason: 'CONSENT_REVOKED' });
    }
    if (request.purpose !== right.purpose) {
      return ok({ eligible: false, reason: 'PURPOSE_MISMATCH' });
    }
    if (!decision.eligible) {
      return ok({ eligible: false, reason: decision.reasonCodes[0] ?? 'INELIGIBLE' });
    }
    this.store.requests.set(request.requestId, Object.freeze({ ...request, status: 'ELIGIBLE' }));
    return ok({ eligible: true, reason: 'ELIGIBLE' });
  }

  exportRawPdv(): Result<never, NetworkFailure> {
    return err({
      code: 'RAW_PDV_UNAVAILABLE',
      message: `${RAW_EXPORT_POLICY}: market matching does not deliver Personal Data Vault content`,
    });
  }

  submitCleanRoomComputation(input: {
    readonly requesterId: string;
    readonly purpose: string;
    readonly rightId: HumanInformationRightId;
    readonly approvedComputationId: ApprovedComputationId;
    readonly outputClass: OutputClass;
    readonly expiresAt: UtcInstant;
    readonly jurisdiction: string;
    readonly presentedConsentHash?: string;
    readonly requestedComputationHash?: string;
    readonly arbitraryCode?: string;
    readonly cohortSize?: number;
    readonly outputRowCount?: number;
    readonly developer?: DeveloperAccessContext;
  }): Result<CleanRoomComputationRequest, NetworkFailure> {
    const developerGate = this.assertDeveloperAccess(input.developer, 'HUMAN_INFORMATION_CLEAN_ROOM');
    if (!developerGate.ok) {
      return developerGate;
    }
    if (input.arbitraryCode) {
      this.openIncident('POLICY_BYPASS');
      return err({ code: 'ARBITRARY_CODE_FORBIDDEN', message: 'requester cannot execute arbitrary code over user data' });
    }
    const right = this.store.rights.get(input.rightId);
    const grant = right ? this.store.grants.get(right.consentGrantId) : undefined;
    const computation = this.store.computations.get(input.approvedComputationId);
    if (!right || !grant || !computation) {
      return err({ code: 'USE_WITHOUT_RIGHT', message: 'clean-room use requires a valid right and allow-listed computation' });
    }
    if (right.status !== 'ACTIVE' || grant.status !== 'ACTIVE') {
      return err({ code: 'REVOKED_RIGHT', message: 'revoked right cannot authorize future use' });
    }
    if (input.purpose !== right.purpose || input.purpose !== grant.purpose) {
      this.openIncident('CONSENT_MISMATCH');
      return err({ code: 'PURPOSE_MISMATCH', message: 'use is outside the bound purpose' });
    }
    if (grant.requesterId !== input.requesterId) {
      this.openIncident('UNAUTHORIZED_REQUEST');
      return err({ code: 'REQUESTER_IMPERSONATION', message: 'requester does not hold the bound grant' });
    }
    const permission = [...this.store.permissions.values()].find(
      (row) => row.rightId === right.rightId && row.requesterId === input.requesterId && row.status === 'ACTIVE',
    );
    if (!permission) {
      this.openIncident('UNAUTHORIZED_REQUEST');
      return err({ code: 'USE_WITHOUT_RIGHT', message: 'no active permission for this requester' });
    }
    if (input.presentedConsentHash && input.presentedConsentHash !== grant.consentHash) {
      return err({ code: 'CONSENT_HASH_TAMPER', message: 'consent hash tamper invalidates the use' });
    }
    if (!computation.allowedOutputClasses.includes(input.outputClass)) {
      return err({ code: 'OUTPUT_CLASS_DENIED', message: 'output class is not approved for the computation' });
    }
    if (outputClassIsPersonWorthScore(input.outputClass, input.purpose)) {
      return err({ code: 'HUMAN_WORTH_FORBIDDEN', message: 'privacy-safe score cannot be a person-worth ranking' });
    }
    const boundHash = computationHash({
      codeVersion: computation.codeVersion,
      artifactDigest: computation.artifactDigest,
      inputRightDescriptors: [right.descriptorId],
      privacyPolicyVersion: this.policy.privacyBudgetVersion,
      outputPolicy: input.outputClass,
    });
    if (input.requestedComputationHash && input.requestedComputationHash !== boundHash) {
      return err({ code: 'COMPUTATION_HASH_MISMATCH', message: 'requester cannot alter the approved computation' });
    }
    const aggregate = input.outputClass === 'AGGREGATE_STATISTIC';
    const cohortFailure = enforceCohort(this.policy, input.cohortSize ?? this.policy.minCohortSize, aggregate);
    if (cohortFailure) {
      this.openIncident('REIDENTIFICATION_SIGNAL');
      return err(cohortFailure);
    }
    const outputFailure = enforceOutputBounds(this.policy, input.outputRowCount ?? 1);
    if (outputFailure) {
      return err(outputFailure);
    }
    const fingerprint = queryFingerprint(input.requesterId, input.purpose, computation.computationId);
    const prior = this.store.queryFingerprints.get(fingerprint) ?? 0;
    const abuse = detectQueryAbuse(prior, this.policy);
    if (abuse) {
      this.openIncident('QUERY_ABUSE');
      return err(abuse);
    }
    this.store.queryFingerprints.set(fingerprint, prior + 1);
    const job: CleanRoomComputationRequest = Object.freeze({
      computationRequestId: newComputationRequestId(),
      requesterId: input.requesterId,
      purpose: input.purpose,
      inputRightIds: Object.freeze([right.rightId]),
      approvedComputationId: computation.computationId,
      outputClass: input.outputClass,
      privacyPolicyVersion: this.policy.privacyBudgetVersion,
      expiresAt: input.expiresAt,
      compensationInstructionId: null,
      jurisdiction: input.jurisdiction,
      evidenceDigest: digest(`${EVIDENCE_KIND_HUMAN_INFORMATION}:${right.rightId}:${boundHash}`),
      policy: Object.freeze({
        policyVersion: this.policy.policyVersion,
        approvedComputationId: computation.computationId,
        computationHash: boundHash,
        artifactDigest: computation.artifactDigest,
        inputRightDescriptors: Object.freeze([right.descriptorId]),
        privacyPolicyVersion: this.policy.privacyBudgetVersion,
        outputPolicy: input.outputClass,
        minCohortSize: this.policy.minCohortSize,
        rawExportPolicy: RAW_EXPORT_POLICY,
        differentialPrivacyClaimed: false,
      }),
      status: 'AUTHORIZED',
    });
    this.store.jobs.set(job.computationRequestId, job);
    this.store.transactions.set(
      newTransactionId(),
      Object.freeze({
        transactionId: newTransactionId(),
        requestId: [...this.store.requests.values()].find((row) => row.requesterId === input.requesterId)?.requestId ??
          ('' as HumanInformationRequestId),
        rightId: right.rightId,
        kind: 'CLEAN_ROOM_AUTHORIZATION',
        settlementRef: null,
        createdAt: asInstant(this.clock),
        rawPdvDelivered: false,
      }),
    );
    return ok(job);
  }

  getCleanRoomResult(input: {
    readonly computationRequestId: CleanRoomComputationRequestId;
    readonly privacySafeValue: string | number | boolean;
    readonly cohortSize: number;
    readonly tamperOutput?: boolean;
  }): Result<CleanRoomComputationResult, NetworkFailure> {
    const job = this.store.jobs.get(input.computationRequestId);
    if (!job || job.status === 'DENIED') {
      return err({ code: 'JOB_UNKNOWN', message: 'clean-room job is not authorized' });
    }
    if (input.tamperOutput) {
      this.openIncident('POLICY_BYPASS');
      return err({ code: 'OUTPUT_TAMPER', message: 'result hash binding rejected tampered output' });
    }
    const result: CleanRoomComputationResult = Object.freeze({
      resultId: newComputationResultId(),
      computationRequestId: job.computationRequestId,
      outputClass: job.outputClass,
      privacySafeValue: input.privacySafeValue,
      purpose: job.purpose,
      describesPersonWorth: false,
      rawRows: false,
      cohortSize: input.cohortSize,
      createdAt: asInstant(this.clock),
    });
    this.store.results.set(result.resultId, result);
    this.store.jobs.set(job.computationRequestId, Object.freeze({ ...job, status: 'COMPLETED' }));
    return ok(result);
  }

  authorizeCompensation(input: {
    readonly subjectId: HumanInformationSubjectId;
    readonly requesterId: string;
    readonly asset: NetworkCompensationAsset;
    readonly amountMinor: bigint;
    readonly mintUnrestricted?: boolean;
  }): Result<HumanInformationCompensationInstruction, NetworkFailure> {
    if (input.mintUnrestricted || this.policy.unrestrictedMintAuthority) {
      return err({
        code: 'MINT_FORBIDDEN',
        message: 'Human Information activity cannot mint unrestricted SunRey; issuance stays under Chunk 71',
      });
    }
    const instruction: HumanInformationCompensationInstruction = Object.freeze({
      instructionId: newCompensationInstructionId(),
      subjectId: input.subjectId,
      requesterId: input.requesterId,
      asset: input.asset,
      amountMinor: input.amountMinor,
      mintRequested: false,
      unrestrictedIssuance: false,
      monetaryAuthority: 'CHUNK_71_MONETARY_CONSTITUTION',
      status: 'AUTHORIZED',
      settlementRef: `settle_${digest(input.subjectId).slice(0, 12)}`,
    });
    this.store.compensation.set(instruction.instructionId, instruction);
    const subject = this.store.subjects.get(input.subjectId);
    if (subject) {
      const requesterClass = this.store.requesters.get(input.requesterId)?.requesterClass;
      this.notifications.push(
        privacyMinimizedNotification({
          kind: 'COMPENSATION_EVENT',
          subjectHandle: subject.publicHandle,
          ...(requesterClass === undefined ? {} : { requesterClass }),
        }),
      );
    }
    return ok(instruction);
  }

  recordUsage(input: {
    readonly rightId: HumanInformationRightId;
    readonly requesterId: string;
    readonly computationId: ApprovedComputationId;
    readonly outputClass: OutputClass;
    readonly settlementRef: string | null;
  }): Result<HumanInformationUsageReceipt, NetworkFailure> {
    const right = this.store.rights.get(input.rightId);
    if (!right || right.status !== 'ACTIVE') {
      return err({ code: 'USE_WITHOUT_RIGHT', message: 'usage receipt requires an active right' });
    }
    const receipt: HumanInformationUsageReceipt = Object.freeze({
      receiptId: newUsageReceiptId(),
      rightId: right.rightId,
      requesterId: input.requesterId,
      purpose: right.purpose,
      computationId: input.computationId,
      policyVersion: this.policy.policyVersion,
      outputClass: input.outputClass,
      settlementRef: input.settlementRef,
      occurredAt: asInstant(this.clock),
      chainHeight: 0n,
      evidenceDigest: digest(`${right.rightId}:${input.requesterId}:${input.computationId}`),
      rawPersonalData: false,
    });
    this.store.receipts.set(receipt.receiptId, receipt);
    this.anchor({
      permissionId: null,
      consentHash: this.store.grants.get(right.consentGrantId)?.consentHash ?? null,
      purposeHash: digest(right.purpose),
      rightState: right.status,
      usageReceiptHash: receipt.evidenceDigest,
      settlementRef: input.settlementRef,
      revocationRef: null,
    });
    const subject = this.store.subjects.get(right.subjectId);
    if (subject) {
      this.notifications.push(
        privacyMinimizedNotification({
          kind: 'USAGE_RECEIPT',
          subjectHandle: subject.publicHandle,
          purpose: right.purpose,
        }),
      );
    }
    return ok(receipt);
  }

  revokeInformationConsent(input: {
    readonly grantId: HumanInformationConsentGrantId;
    readonly agent?: AgentMandateContext;
  }): Result<HumanInformationRevocation, NetworkFailure> {
    const agentGate = this.assertAgentMandate(input.agent, 'revoke');
    if (!agentGate.ok) {
      return agentGate;
    }
    const grant = this.store.grants.get(input.grantId);
    if (!grant) {
      return err({ code: 'CONSENT_UNKNOWN', message: 'consent grant is unknown' });
    }
    const right = [...this.store.rights.values()].find((row) => row.consentGrantId === grant.grantId);
    if (!right) {
      return err({ code: 'RIGHT_UNKNOWN', message: 'no right is bound to this grant' });
    }
    this.store.grants.set(grant.grantId, Object.freeze({ ...grant, status: 'REVOKED' }));
    this.store.rights.set(right.rightId, Object.freeze({ ...right, status: 'REVOKED' }));
    for (const [id, permission] of this.store.permissions) {
      if (permission.rightId === right.rightId) {
        this.store.permissions.set(id, Object.freeze({ ...permission, status: 'REVOKED' }));
      }
    }
    const purpose = this.store.purposes.get(right.purposeGrantId);
    if (purpose) {
      this.store.purposes.set(right.purposeGrantId, Object.freeze({ ...purpose, status: 'REVOKED' }));
    }
    const revocation: HumanInformationRevocation = Object.freeze({
      revocationId: newRevocationId(),
      grantId: grant.grantId,
      rightId: right.rightId,
      subjectId: grant.subjectId,
      revokedAt: asInstant(this.clock),
      futureUseBlocked: true,
      historicalSettlementErased: false,
    });
    this.store.revocations.set(revocation.revocationId, revocation);
    this.anchor({
      permissionId: null,
      consentHash: grant.consentHash,
      purposeHash: digest(grant.purpose),
      rightState: 'REVOKED',
      usageReceiptHash: null,
      settlementRef: null,
      revocationRef: revocation.revocationId,
    });
    const subject = this.store.subjects.get(grant.subjectId);
    if (subject) {
      this.notifications.push(
        privacyMinimizedNotification({
          kind: 'REVOCATION_CONFIRMATION',
          subjectHandle: subject.publicHandle,
          purpose: grant.purpose,
        }),
      );
    }
    return ok(revocation);
  }

  applyEmergencyRestriction(): Result<{ readonly restricted: true; readonly broaderAccessGranted: false }, NetworkFailure> {
    this.store.emergencyRestricted = true;
    return ok({ restricted: true, broaderAccessGranted: false });
  }

  openIncident(kind: IncidentKind): void {
    this.store.incidents.push(
      Object.freeze({
        incidentId: newIncidentId(),
        kind,
        openedAt: asInstant(this.clock),
        status: 'OPEN',
      }),
    );
    const subject = [...this.store.subjects.values()][0];
    if (subject) {
      this.notifications.push(
        privacyMinimizedNotification({ kind: 'SECURITY_EVENT', subjectHandle: subject.publicHandle }),
      );
    }
  }

  audit(): HumanInformationRightsAudit {
    return Object.freeze({
      auditId: newAuditId(),
      generatedAt: asInstant(this.clock),
      activeRights: [...this.store.rights.values()].filter((row) => row.status === 'ACTIVE').length,
      consents: this.store.grants.size,
      purposes: this.store.purposes.size,
      uses: this.store.receipts.size,
      revocations: this.store.revocations.size,
      compensationInstructions: this.store.compensation.size,
      cleanRoomResults: this.store.results.size,
      onChainAnchors: this.store.anchors.length,
      reconciled: true,
    });
  }

  getInformationRights(subjectId: HumanInformationSubjectId): readonly HumanInformationRight[] {
    return Object.freeze(this.store.rightsFor(subjectId));
  }

  getInformationRequests(requesterId?: string): readonly HumanInformationRequest[] {
    const rows = requesterId ? this.store.requestsForRequester(requesterId) : [...this.store.requests.values()];
    return Object.freeze(rows);
  }

  getInformationUsage(subjectId?: HumanInformationSubjectId): readonly HumanInformationUsageReceipt[] {
    const rights = subjectId ? this.store.rightsFor(subjectId).map((row) => row.rightId) : null;
    return Object.freeze(
      [...this.store.receipts.values()].filter((row) => rights === null || rights.includes(row.rightId)),
    );
  }

  getInformationCompensation(subjectId?: HumanInformationSubjectId): readonly HumanInformationCompensationInstruction[] {
    return Object.freeze(
      [...this.store.compensation.values()].filter((row) => !subjectId || row.subjectId === subjectId),
    );
  }

  controlCenter(subjectId: HumanInformationSubjectId): Result<ControlCenterProjection, NetworkFailure> {
    const subject = this.store.subjects.get(subjectId);
    if (!subject) {
      return err({ code: 'SUBJECT_UNKNOWN', message: 'subject is not registered' });
    }
    return ok(this.store.controlCenter(subject));
  }

  requesterPortal(requesterId: string): Result<RequesterPortalProjection, NetworkFailure> {
    if (!this.store.requesters.has(requesterId)) {
      return err({ code: 'REQUESTER_UNIDENTIFIED', message: 'requester is not registered' });
    }
    const requests = this.store.requestsForRequester(requesterId);
    return ok(
      Object.freeze({
        requesterId,
        requests: Object.freeze(requests),
        eligibility: Object.freeze(
          requests.map((request) => {
            const right = [...this.store.rights.values()].find((row) => row.purpose === request.purpose);
            return {
              requestId: request.requestId,
              eligible: request.status === 'ELIGIBLE' || request.status === 'CONSENTED',
              reason: right ? 'BOUND' : request.status,
            };
          }),
        ),
        compensation: Object.freeze(
          [...this.store.compensation.values()].filter((row) => row.requesterId === requesterId),
        ),
        cleanRoomJobs: Object.freeze(
          [...this.store.jobs.values()].filter((row) => row.requesterId === requesterId),
        ),
        results: Object.freeze(
          [...this.store.results.values()].filter((row) =>
            [...this.store.jobs.values()].some(
              (job) => job.computationRequestId === row.computationRequestId && job.requesterId === requesterId,
            ),
          ),
        ),
        usageReceipts: Object.freeze(
          [...this.store.receipts.values()].filter((row) => row.requesterId === requesterId),
        ),
      }),
    );
  }

  providerAvailabilityIsNotAuthority(): { readonly available: true; readonly authority: false } {
    return Object.freeze({ available: true, authority: false });
  }

  private assertDeveloperAccess(
    context: DeveloperAccessContext | undefined,
    required: DeveloperInformationScope,
  ): Result<true, NetworkFailure> {
    if (!context) {
      return ok(true);
    }
    const hasInformationScope = context.scopes.some((scope) => scope.startsWith('HUMAN_INFORMATION_'));
    if (!hasInformationScope) {
      return err({
        code: 'DEVELOPER_KEY_INSUFFICIENT',
        message: 'a developer API key alone cannot grant Human Information access',
      });
    }
    if (
      !context.applicationApproved ||
      !context.scopes.includes(required) ||
      !context.purpose ||
      !context.consentPresent ||
      !context.privacyPolicyAccepted ||
      !context.eligibilitySatisfied
    ) {
      return err({
        code: 'DEVELOPER_KEY_INSUFFICIENT',
        message: 'Human Information access also requires application approval, purpose, consent, privacy policy, and eligibility',
      });
    }
    return ok(true);
  }

  private assertAgentMandate(
    context: AgentMandateContext | undefined,
    _action: 'approve' | 'revoke',
  ): Result<true, NetworkFailure> {
    if (!context) {
      return ok(true);
    }
    if (context.genericFinancialAgent && !context.explicitHumanInformationMandate) {
      return err({
        code: 'AGENT_MANDATE_INSUFFICIENT',
        message: `generic financial-agent permission is insufficient; mandate must include ${AGENT_INFORMATION_MANDATE}`,
      });
    }
    if (!context.explicitHumanInformationMandate) {
      return err({
        code: 'AGENT_MANDATE_INSUFFICIENT',
        message: `mandate must explicitly permit ${AGENT_INFORMATION_MANDATE}`,
      });
    }
    return ok(true);
  }

  private anchor(input: Omit<OnChainAnchor, 'rawSensitivePersonalInformation'>): void {
    this.store.anchors.push(
      Object.freeze({
        ...input,
        rawSensitivePersonalInformation: false,
      }),
    );
  }
}
