import { createHash } from 'node:crypto';

import type { Clock } from '../../../config/src/clock.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { EvidenceVault } from '../../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../../events/src/events.ts';
import { Money } from '../../../money/src/money.ts';
import type { FiatCompensationPort } from '../types.ts';
import { accessModeForProduct, describeAccess, refuseRawDatabaseAccess } from './access.ts';
import { allocateCompensation } from './compensation.ts';
import { evaluateProductEligibility } from './eligibility.ts';
import {
  newDataProductId,
  newInformationLicenseId,
  newInformationRightId,
  newLicenseRequestId,
  newLicenseSettlementId,
  newUsageEventId,
} from './ids.ts';
import { enforceAggregation, privacyControlsFor, suppressIfBelowThreshold } from './privacy.ts';
import { simulationCompensationPolicyV1, simulationPricingPolicyV1, validatePricingPolicy } from './policy.ts';
import { enforcePurpose, refusePurposeExpansion } from './purpose.ts';
import { evaluateLicenseeGate, issueLicenseeCredentialRef } from './security.ts';
import { RightsMarketplaceStore } from './store.ts';
import {
  EVIDENCE_KIND_RIGHTS_MARKETPLACE,
  MARKETPLACE_LEGAL_STATUS,
  PRODUCTION_ACTIVE,
  RAW_DATABASE_ACCESS,
  SENSITIVE_CATEGORIES,
  canTransitionLicense,
  formIsPrivacyPreferred,
  type AccessKind,
  type DataProductForm,
  type LicensePurpose,
  type LicenseStatus,
} from './taxonomy.ts';
import type {
  CompensationPolicy,
  ControlledAccessResult,
  DataProduct,
  InformationLicense,
  InformationRight,
  LicenseRequest,
  LicenseSettlement,
  LicenseeSecurity,
  PricingPolicy,
  RevocationRecord,
  RightsMarketplaceFailure,
  UsageEvent,
} from './types.ts';

export type ConsentPort = {
  isActive(input: { readonly subjectId: string; readonly consentRef: string; readonly purpose: string }): boolean;
};

export type NativeAssetTransferPort = {
  transfer(input: {
    readonly actorId: string;
    readonly fromOwnerId: string;
    readonly toOwnerId: string;
    readonly quantity: { readonly scaledUnits: bigint; readonly assetId: string };
  }): { readonly outcome: 'OK'; readonly transferId: string } | { readonly outcome: 'REJECTED'; readonly code: string; readonly message: string };
  mint(): { readonly outcome: 'REJECTED'; readonly code: 'MARKETPLACE_CANNOT_MINT'; readonly message: string };
};

export type RightsMarketplaceOptions = {
  readonly clock: Clock;
  readonly consent: ConsentPort;
  readonly evidence?: EvidenceVault;
  readonly events?: DomainEventLog;
  readonly fiat?: FiatCompensationPort;
  readonly nativeAsset?: NativeAssetTransferPort;
  readonly store?: RightsMarketplaceStore;
};

export type RegisterRightInput = {
  readonly rightsHolder: string;
  readonly underlyingCategory: string;
  readonly scope: string;
  readonly eligiblePurposes: readonly LicensePurpose[];
  readonly prohibitedPurposes?: readonly LicensePurpose[];
  readonly jurisdiction: string;
  readonly privacyRequirements: readonly string[];
  readonly consentDependency: string;
  readonly termsVersion: string;
  readonly licenseability?: InformationRight['licenseability'];
};

export type CreateProductInput = {
  readonly form: DataProductForm;
  readonly displayName: string;
  readonly rightIds: readonly string[];
  readonly classification: string;
  readonly eligiblePurposes: readonly LicensePurpose[];
  readonly prohibitedPurposes?: readonly LicensePurpose[];
  readonly purpose: LicensePurpose;
  readonly minimumAggregationThreshold: number;
  readonly jurisdiction: string;
  readonly retentionDays: number;
  readonly privacyPolicyVersion: string;
  readonly consentRef: string;
  readonly cohortSize?: number;
};

export class InformationRightsMarketplace {
  private readonly clock: Clock;
  private readonly consent: ConsentPort;
  private readonly evidence: EvidenceVault | undefined;
  private readonly events: DomainEventLog | undefined;
  private readonly fiat: FiatCompensationPort | undefined;
  private readonly nativeAsset: NativeAssetTransferPort | undefined;
  readonly store: RightsMarketplaceStore;

  constructor(options: RightsMarketplaceOptions) {
    this.clock = options.clock;
    this.consent = options.consent;
    this.evidence = options.evidence;
    this.events = options.events;
    this.fiat = options.fiat;
    this.nativeAsset = options.nativeAsset;
    this.store = options.store ?? new RightsMarketplaceStore();
  }

  legalStatus() {
    return MARKETPLACE_LEGAL_STATUS;
  }

  productionActive(): false {
    return PRODUCTION_ACTIVE;
  }

  registerCompensationPolicy(policy: CompensationPolicy): Result<CompensationPolicy, RightsMarketplaceFailure> {
    this.store.policies.set(policy.policyId, policy);
    return ok(policy);
  }

  registerPricingPolicy(policy: PricingPolicy): Result<PricingPolicy, RightsMarketplaceFailure> {
    const invalid = validatePricingPolicy(policy);
    if (invalid) return err({ code: 'PRICING_POLICY_INVALID', message: invalid });
    this.store.pricing.set(policy.policyId, policy);
    return ok(policy);
  }

  registerRight(input: RegisterRightInput): Result<InformationRight, RightsMarketplaceFailure> {
    if (input.eligiblePurposes.length === 0) {
      return err({ code: 'PURPOSE_REQUIRED', message: 'eligible purposes are required' });
    }
    if (input.jurisdiction.length !== 2) {
      return err({ code: 'JURISDICTION_INVALID', message: 'jurisdiction must be an ISO-like simulation code' });
    }
    const right: InformationRight = Object.freeze({
      rightId: newInformationRightId(),
      rightsHolder: input.rightsHolder,
      underlyingCategory: input.underlyingCategory,
      underlyingProductId: null,
      scope: input.scope,
      eligiblePurposes: Object.freeze([...input.eligiblePurposes]),
      prohibitedPurposes: Object.freeze([...(input.prohibitedPurposes ?? [])]),
      transferability: 'LICENSEABLE_ONLY',
      licenseability: input.licenseability ?? 'LICENSEABLE',
      jurisdiction: input.jurisdiction,
      privacyRequirements: Object.freeze([...input.privacyRequirements]),
      consentDependency: input.consentDependency,
      status: 'ACTIVE',
      termsVersion: input.termsVersion,
      ownershipTransferred: false,
      usageRightOnly: true,
      createdAt: this.now(),
    });
    this.store.rights.set(right.rightId, right);
    if (!this.store.participation.has(input.rightsHolder)) {
      this.store.participation.set(input.rightsHolder, 'ACTIVE');
    }
    this.seal('right.registered', { rightId: right.rightId, rightsHolder: right.rightsHolder });
    return ok(right);
  }

  createDataProduct(actorSubjectId: string, input: CreateProductInput): Result<DataProduct, RightsMarketplaceFailure> {
    const rights: InformationRight[] = [];
    for (const rightId of input.rightIds) {
      const right = this.store.rights.get(rightId);
      if (!right) return err({ code: 'RIGHT_UNKNOWN', message: 'information right not found' });
      if (right.rightsHolder !== actorSubjectId) {
        return err({ code: 'RIGHT_NOT_OWNED', message: 'only the rights holder may attach a right to a product' });
      }
      rights.push(right);
    }
    const consentActive = this.consent.isActive({
      subjectId: actorSubjectId,
      consentRef: input.consentRef,
      purpose: input.purpose,
    });
    const sensitive = rights.some((right) => (SENSITIVE_CATEGORIES as readonly string[]).includes(right.underlyingCategory));
    const draft = {
      form: input.form,
      rightIds: input.rightIds as DataProduct['rightIds'],
      classification: input.classification,
      eligiblePurposes: input.eligiblePurposes,
      sensitiveCategory: sensitive,
      minimumAggregationThreshold: input.minimumAggregationThreshold,
      jurisdiction: input.jurisdiction,
      retentionDays: input.retentionDays,
      licensingEligible: true,
      privacyPolicyVersion: input.privacyPolicyVersion,
    };
    const blocked = evaluateProductEligibility({
      product: draft,
      rights,
      consentActive,
      purpose: input.purpose,
      cohortSize: input.cohortSize,
    });
    if (blocked) return err(blocked);
    const product: DataProduct = Object.freeze({
      productId: newDataProductId(),
      form: input.form,
      displayName: input.displayName,
      rightIds: Object.freeze([...input.rightIds]) as DataProduct['rightIds'],
      classification: input.classification,
      eligiblePurposes: Object.freeze([...input.eligiblePurposes]),
      prohibitedPurposes: Object.freeze([...(input.prohibitedPurposes ?? [])]),
      sensitiveCategory: sensitive,
      minimumAggregationThreshold: input.minimumAggregationThreshold,
      jurisdiction: input.jurisdiction,
      retentionDays: input.retentionDays,
      licensingEligible: true,
      privacyPolicyVersion: input.privacyPolicyVersion,
      accessMode: accessModeForProduct(input.form),
      rawDatabaseAccess: false,
      differentialPrivacyClaimed: false,
      status: 'ELIGIBLE',
      createdAt: this.now(),
    });
    this.store.products.set(product.productId, product);
    this.emit('InformationDataProductCreated', product.productId, {
      productId: product.productId,
      form: product.form,
      privacyPreferred: formIsPrivacyPreferred(product.form),
    });
    return ok(product);
  }

  requestLicense(input: {
    readonly licenseeId: string;
    readonly productId: string;
    readonly purpose: LicensePurpose;
    readonly scope: string;
    readonly durationDays: number;
    readonly queryLimit: number;
    readonly downloadLimit: number;
    readonly jurisdiction: string;
    readonly consentRef?: string;
  }): Result<LicenseRequest, RightsMarketplaceFailure> {
    const product = this.store.products.get(input.productId);
    if (!product) return err({ code: 'PRODUCT_UNKNOWN', message: 'data product not found' });
    if (product.status !== 'ELIGIBLE' || !product.licensingEligible) {
      return err({ code: 'PRODUCT_INELIGIBLE', message: 'product is not eligible for licensing' });
    }
    if (product.prohibitedPurposes.includes(input.purpose) || !product.eligiblePurposes.includes(input.purpose)) {
      return err({ code: 'PURPOSE_MISMATCH', message: `product does not permit ${input.purpose}` });
    }
    const request: LicenseRequest = Object.freeze({
      requestId: newLicenseRequestId(),
      licenseeId: input.licenseeId,
      productId: product.productId,
      purpose: input.purpose,
      scope: input.scope,
      durationDays: input.durationDays,
      queryLimit: input.queryLimit,
      downloadLimit: input.downloadLimit,
      jurisdiction: input.jurisdiction,
      consentRef: input.consentRef ?? null,
      status: input.consentRef ? 'AWAITING_APPROVAL' : 'AWAITING_CONSENT',
      createdAt: this.now(),
    });
    this.store.requests.set(request.requestId, request);
    return ok(request);
  }

  approveAndActivate(input: {
    readonly requestId: string;
    readonly actorId: string;
    readonly pricingPolicyId: string;
    readonly compensationPolicyId: string;
    readonly termsVersion: string;
    readonly paid?: boolean;
  }): Result<InformationLicense, RightsMarketplaceFailure> {
    const request = this.store.requests.get(input.requestId);
    if (!request) return err({ code: 'REQUEST_UNKNOWN', message: 'license request not found' });
    const product = this.store.products.get(request.productId);
    const pricing = this.store.pricing.get(input.pricingPolicyId);
    const policy = this.store.policies.get(input.compensationPolicyId);
    if (!product || !pricing || !policy) {
      return err({ code: 'POLICY_OR_PRODUCT_MISSING', message: 'pricing, compensation policy, and product are required' });
    }
    const rights = product.rightIds.map((id) => this.store.rights.get(id)).filter((row): row is InformationRight => Boolean(row));
    if (rights.some((right) => right.status !== 'ACTIVE')) {
      return err({ code: 'RIGHT_NOT_ACTIVE', message: 'underlying rights must be ACTIVE' });
    }
    if (this.store.participation.get(rights[0]?.rightsHolder ?? '') === 'WITHDRAWN') {
      return err({ code: 'PARTICIPATION_WITHDRAWN', message: 'rights holder has withdrawn HIN participation' });
    }
    if (this.store.participation.get(rights[0]?.rightsHolder ?? '') === 'PAUSED') {
      return err({ code: 'PARTICIPATION_PAUSED', message: 'rights holder has paused HIN participation' });
    }
    if (!request.consentRef) {
      return err({ code: 'CONSENT_REQUIRED', message: 'consent must gate license activation' });
    }
    const consentActive = rights.every((right) =>
      this.consent.isActive({ subjectId: right.rightsHolder, consentRef: request.consentRef!, purpose: request.purpose }),
    );
    if (!consentActive) {
      this.store.requests.set(request.requestId, Object.freeze({ ...request, status: 'AWAITING_CONSENT' }));
      return err({ code: 'CONSENT_REQUIRED', message: 'canonical consent must be ACTIVE for the licensed purpose' });
    }
    if (!input.paid) {
      this.store.requests.set(request.requestId, Object.freeze({ ...request, status: 'AWAITING_PAYMENT' }));
      return err({ code: 'PAYMENT_REQUIRED', message: 'license activation requires configured payment' });
    }
    const now = this.now();
    const expiresAt = addDays(now, request.durationDays);
    const fiat = pricing.fixedFiat ?? pricing.usageUnitFiat ?? pricing.subscriptionFiat ?? pricing.negotiatedFiat;
    const license: InformationLicense = Object.freeze({
      licenseId: newInformationLicenseId(),
      requestId: request.requestId,
      licenseeId: request.licenseeId,
      productId: product.productId,
      purpose: request.purpose,
      scope: request.scope,
      durationDays: request.durationDays,
      queryLimit: request.queryLimit,
      downloadLimit: request.downloadLimit,
      redistribution: 'PROHIBITED',
      retentionDays: product.retentionDays,
      compensation: Object.freeze({
        asset: 'FIAT_MONEY',
        ...(fiat ? { fiat } : {}),
        pricingPolicyId: pricing.policyId,
        compensationPolicyId: policy.policyId,
      }),
      revocationRules: Object.freeze({
        consentRevocationStopsFutureAccess: true,
        historicalLawfulUsageRetained: true,
        dataDeletionIfApplicable: true,
        remainingObligations: 'historical lawful usage may be retained; future access stops',
      }),
      termsVersion: input.termsVersion,
      status: 'ACTIVE',
      activatedAt: now,
      expiresAt,
      revokedAt: null,
      createdAt: now,
    });
    this.store.licenses.set(license.licenseId, license);
    this.store.requests.set(request.requestId, Object.freeze({ ...request, status: 'APPROVED' }));
    this.emit('InformationLicenseActivated', license.licenseId, {
      licenseId: license.licenseId,
      purpose: license.purpose,
      productId: license.productId,
    });
    this.seal('license.activated', { licenseId: license.licenseId, purpose: license.purpose });
    return ok(license);
  }

  registerLicenseeCredential(input: {
    readonly licenseeId: string;
    readonly clientIdentity: string;
    readonly purposeRestrictions: readonly LicensePurpose[];
    readonly rateLimitPerWindow: number;
  }): Result<LicenseeSecurity, RightsMarketplaceFailure> {
    const credential = issueLicenseeCredentialRef(input);
    this.store.credentials.set(credential.credentialId, credential);
    return ok(credential);
  }

  engageKillSwitch(credentialId: string): Result<LicenseeSecurity, RightsMarketplaceFailure> {
    const current = this.store.credentials.get(credentialId);
    if (!current) return err({ code: 'CREDENTIAL_UNKNOWN', message: 'licensee credential not found' });
    const next = Object.freeze({ ...current, killSwitch: true });
    this.store.credentials.set(credentialId, next);
    return ok(next);
  }

  suspendForIncident(credentialId: string): Result<LicenseeSecurity, RightsMarketplaceFailure> {
    const current = this.store.credentials.get(credentialId);
    if (!current) return err({ code: 'CREDENTIAL_UNKNOWN', message: 'licensee credential not found' });
    const next = Object.freeze({ ...current, incidentSuspension: true });
    this.store.credentials.set(credentialId, next);
    return ok(next);
  }

  controlledAccess(input: {
    readonly licenseId: string;
    readonly licenseeId: string;
    readonly purpose: LicensePurpose;
    readonly accessKind: AccessKind;
    readonly credentialId?: string;
    readonly cohortSize?: number;
    readonly requestedPurpose?: LicensePurpose;
  }): Result<ControlledAccessResult, RightsMarketplaceFailure> {
    const license = this.store.licenses.get(input.licenseId);
    if (!license) return err({ code: 'LICENSE_UNKNOWN', message: 'license not found' });
    if (license.licenseeId !== input.licenseeId) {
      return err({ code: 'LICENSEE_SCOPE', message: 'license is not issued to this licensee' });
    }
    const expired = this.expireIfNeeded(license);
    if (expired.status !== 'ACTIVE') {
      return err({ code: `LICENSE_${expired.status}`, message: `license is ${expired.status.toLowerCase()}` });
    }
    const purposeGate = enforcePurpose({
      licensedPurpose: expired.purpose,
      requestedPurpose: input.requestedPurpose ?? input.purpose,
    });
    if (purposeGate) return err(purposeGate);
    if (input.credentialId) {
      const credential = this.store.credentials.get(input.credentialId);
      if (!credential) return err({ code: 'CREDENTIAL_UNKNOWN', message: 'licensee credential not found' });
      const gated = evaluateLicenseeGate(credential, expired.purpose);
      if (gated) return err(gated);
    }
    const product = this.store.products.get(expired.productId);
    if (!product) return err({ code: 'PRODUCT_UNKNOWN', message: 'data product not found' });
    const prior = [...this.store.usage.values()].filter((row) => row.licenseId === expired.licenseId).length;
    const privacy = enforceAggregation({
      product,
      cohortSize: input.cohortSize ?? product.minimumAggregationThreshold,
      priorQueries: prior,
      queryLimit: expired.queryLimit,
    });
    if (privacy) return err(privacy);
    const usage = this.recordUsage({
      license: expired,
      accessKind: input.accessKind,
      volume: 1,
    });
    if (!usage.ok) return usage;
    const suppressed = suppressIfBelowThreshold(1, input.cohortSize ?? product.minimumAggregationThreshold, product.minimumAggregationThreshold);
    return ok(
      Object.freeze({
        licenseId: expired.licenseId,
        accessMode: product.accessMode,
        purpose: expired.purpose,
        outputClass: suppressed === null ? 'DENIED' : 'PRIVACY_SAFE',
        payload: suppressed === null ? null : describeAccess(product.accessMode),
        rawDatabaseCredential: false,
        rawRows: false,
      }),
    );
  }

  requestDatabaseCredential(): Result<never, RightsMarketplaceFailure> {
    return err(refuseRawDatabaseAccess());
  }

  recordUsageEvent(input: {
    readonly licenseId: string;
    readonly licenseeId: string;
    readonly accessKind: AccessKind;
    readonly volume: number;
    readonly rawQueryOutput?: unknown;
  }): Result<UsageEvent, RightsMarketplaceFailure> {
    if (input.rawQueryOutput !== undefined) {
      return err({
        code: 'RAW_QUERY_OUTPUT_FORBIDDEN',
        message: 'raw sensitive query output must not be placed in generic logs',
      });
    }
    const license = this.store.licenses.get(input.licenseId);
    if (!license) return err({ code: 'LICENSE_UNKNOWN', message: 'license not found' });
    if (license.licenseeId !== input.licenseeId) {
      return err({ code: 'LICENSEE_SCOPE', message: 'license is not issued to this licensee' });
    }
    return this.recordUsage({ license, accessKind: input.accessKind, volume: input.volume });
  }

  settleUsage(input: {
    readonly usageId: string;
    readonly actorId: string;
    readonly sponsorCustomerId: string;
    readonly sponsorOwnerId?: string;
    readonly rightsHolderCustomerId: string;
    readonly rightsHolderAccountId: string;
  }): Result<LicenseSettlement, RightsMarketplaceFailure> {
    const usage = this.store.usage.get(input.usageId);
    if (!usage) return err({ code: 'USAGE_UNKNOWN', message: 'usage event not found' });
    const replay = `settle:${usage.usageId}`;
    if (this.store.replayKeys.has(replay)) {
      return err({ code: 'DUPLICATE_USAGE', message: 'duplicate usage settlement is denied' });
    }
    const license = this.store.licenses.get(usage.licenseId);
    if (!license) return err({ code: 'LICENSE_UNKNOWN', message: 'license not found' });
    const policy = this.store.policies.get(license.compensation.compensationPolicyId);
    if (!policy) return err({ code: 'COMPENSATION_POLICY_MISSING', message: 'versioned compensation policy is required' });
    const product = this.store.products.get(license.productId);
    const rightsHolder = product ? this.store.rights.get(product.rightIds[0] ?? '')?.rightsHolder : undefined;
    if (!rightsHolder) return err({ code: 'RIGHTS_HOLDER_UNKNOWN', message: 'rights holder missing' });
    const settlementId = newLicenseSettlementId();
    const allocated = allocateCompensation({
      policy,
      terms: license.compensation,
      settlementId,
      licenseId: license.licenseId,
      rightsHolder,
    });
    if (!allocated.ok) return err(allocated.error);
    let journalId: string | null = null;
    let nativeTransferId: string | null = null;
    const holderShare = allocated.allocations.find((row) => row.recipientClass === 'INDIVIDUAL_RIGHTS_HOLDER');
    if (license.compensation.asset === 'FIAT_MONEY' && holderShare?.fiat) {
      if (!this.fiat) return err({ code: 'LEDGER_PORT_MISSING', message: 'fiat compensation requires the Phase C Ledger port' });
      const credit = this.fiat.creditParticipant({
        actorId: input.actorId,
        customerId: input.rightsHolderCustomerId,
        participantAccountId: input.rightsHolderAccountId,
        amount: holderShare.fiat,
        contributionId: usage.usageId,
      });
      if (credit.outcome !== 'OK') {
        return err({ code: credit.code, message: credit.message });
      }
      journalId = credit.journalId;
    } else if (license.compensation.asset === 'SUNREY_COIN' && holderShare?.coin) {
      if (!this.nativeAsset) {
        return err({ code: 'NATIVE_ASSET_PORT_MISSING', message: 'native-asset compensation uses Phase G authority, not marketplace mint' });
      }
      const minted = this.nativeAsset.mint();
      if ((minted.outcome as string) === 'OK') {
        return err({ code: 'MARKETPLACE_CANNOT_MINT', message: 'marketplace cannot mint native assets' });
      }
      const transfer = this.nativeAsset.transfer({
        actorId: input.actorId,
        fromOwnerId: input.sponsorOwnerId ?? input.sponsorCustomerId,
        toOwnerId: rightsHolder,
        quantity: { scaledUnits: holderShare.coin.scaledUnits, assetId: holderShare.coin.assetId },
      });
      if (transfer.outcome !== 'OK') {
        return err({ code: transfer.code, message: transfer.message });
      }
      nativeTransferId = transfer.transferId;
    }
    const settlement: LicenseSettlement = Object.freeze({
      settlementId,
      licenseId: license.licenseId,
      usageId: usage.usageId,
      policyVersion: policy.version,
      ...(license.compensation.fiat ? { revenueFiat: license.compensation.fiat } : {}),
      ...(license.compensation.coin ? { revenueCoin: license.compensation.coin } : {}),
      allocations: allocated.allocations,
      journalId,
      nativeTransferId,
      evidenceRef: hashRef(`${settlementId}:${usage.usageId}`),
      createdAt: this.now(),
    });
    this.store.settlements.set(settlement.settlementId, settlement);
    this.store.replayKeys.add(replay);
    this.seal('settlement.posted', {
      settlementId: settlement.settlementId,
      journalId,
      nativeTransferId,
      usageId: usage.usageId,
    });
    return ok(settlement);
  }

  revokeLicense(input: {
    readonly licenseId: string;
    readonly actorSubjectId: string;
    readonly reason: string;
  }): Result<RevocationRecord, RightsMarketplaceFailure> {
    const license = this.store.licenses.get(input.licenseId);
    if (!license) return err({ code: 'LICENSE_UNKNOWN', message: 'license not found' });
    const product = this.store.products.get(license.productId);
    const holder = product ? this.store.rights.get(product.rightIds[0] ?? '')?.rightsHolder : undefined;
    if (holder !== input.actorSubjectId && license.licenseeId !== input.actorSubjectId) {
      return err({ code: 'CROSS_USER', message: 'only the rights holder or licensee may revoke' });
    }
    if (!canTransitionLicense(license.status, 'REVOKED')) {
      return err({ code: 'LICENSE_NOT_REVOCABLE', message: `cannot revoke from ${license.status}` });
    }
    const now = this.now();
    const revoked = Object.freeze({ ...license, status: 'REVOKED' as const, revokedAt: now });
    this.store.licenses.set(revoked.licenseId, revoked);
    this.emit('InformationLicenseRevoked', revoked.licenseId, { licenseId: revoked.licenseId, reason: input.reason });
    this.seal('license.revoked', { licenseId: revoked.licenseId, revokedAt: now });
    return ok(
      Object.freeze({
        licenseId: revoked.licenseId,
        revokedAt: now,
        remainingObligations: revoked.revocationRules.remainingObligations,
        dataDeletionObligation: revoked.revocationRules.dataDeletionIfApplicable,
        historicalLawfulUsageRetained: true,
        futureAccessStopped: true,
      }),
    );
  }

  expireLicense(licenseId: string): Result<InformationLicense, RightsMarketplaceFailure> {
    const license = this.store.licenses.get(licenseId);
    if (!license) return err({ code: 'LICENSE_UNKNOWN', message: 'license not found' });
    return ok(this.expireIfNeeded(license, true));
  }

  pauseParticipation(rightsHolder: string): Result<{ readonly status: 'PAUSED' }, RightsMarketplaceFailure> {
    this.store.participation.set(rightsHolder, 'PAUSED');
    return ok({ status: 'PAUSED' });
  }

  withdrawParticipation(rightsHolder: string): Result<{ readonly status: 'WITHDRAWN' }, RightsMarketplaceFailure> {
    this.store.participation.set(rightsHolder, 'WITHDRAWN');
    for (const right of this.store.rights.values()) {
      if (right.rightsHolder === rightsHolder && right.status === 'ACTIVE') {
        this.store.rights.set(right.rightId, Object.freeze({ ...right, status: 'WITHDRAWN' }));
      }
    }
    return ok({ status: 'WITHDRAWN' });
  }

  mintFromMarketplace(): Result<never, RightsMarketplaceFailure> {
    return err({
      code: 'MARKETPLACE_CANNOT_MINT',
      message: 'marketplace cannot mint native assets; use Phase G native-asset authority',
    });
  }

  refusePurposeExpansion(from: LicensePurpose, to: LicensePurpose): Result<never, RightsMarketplaceFailure> {
    return err(refusePurposeExpansion(from, to));
  }

  privacyControls(productId: string, queryLimit: number) {
    const product = this.store.products.get(productId);
    if (!product) return err({ code: 'PRODUCT_UNKNOWN', message: 'data product not found' });
    return ok(privacyControlsFor(product, queryLimit));
  }

  rightsFor(rightsHolder: string): readonly InformationRight[] {
    return Object.freeze([...this.store.rights.values()].filter((row) => row.rightsHolder === rightsHolder));
  }

  licensesForHolder(rightsHolder: string): readonly InformationLicense[] {
    const rightIds = new Set(this.rightsFor(rightsHolder).map((row) => row.rightId));
    return Object.freeze(
      [...this.store.licenses.values()].filter((license) => {
        const product = this.store.products.get(license.productId);
        return product ? product.rightIds.some((id) => rightIds.has(id)) : false;
      }),
    );
  }

  licensesForLicensee(licenseeId: string): readonly InformationLicense[] {
    return Object.freeze([...this.store.licenses.values()].filter((row) => row.licenseeId === licenseeId));
  }

  earningsFor(rightsHolder: string) {
    const licenseIds = new Set(this.licensesForHolder(rightsHolder).map((row) => row.licenseId));
    const allocations = [...this.store.settlements.values()]
      .flatMap((row) => row.allocations)
      .filter((row) => licenseIds.has(row.licenseId) && row.recipientClass === 'INDIVIDUAL_RIGHTS_HOLDER');
    const settledFiat = allocations.reduce((sum, row) => sum + (row.fiat?.minorUnits ?? 0n), 0n);
    return Object.freeze({
      schema: 'sunrey.consumer.hin.earnings.v1' as const,
      rightsHolder,
      settledMinorUnits: settledFiat.toString(),
      currency: 'USD',
      guaranteed: false,
      compensationGuaranteed: false,
      items: allocations,
    });
  }

  earningsActivity(rightsHolder: string) {
    const licenseIds = new Set(this.licensesForHolder(rightsHolder).map((row) => row.licenseId));
    const events = [...this.store.settlements.values()]
      .filter((row) => licenseIds.has(row.licenseId))
      .map((row) =>
        Object.freeze({
          settlementId: row.settlementId,
          licenseId: row.licenseId,
          occurredAt: row.createdAt,
          journalId: row.journalId,
          nativeTransferId: row.nativeTransferId,
          guaranteed: false,
        }),
      );
    return Object.freeze({
      schema: 'sunrey.consumer.hin.earnings-activity.v1' as const,
      items: Object.freeze(events),
      guaranteed: false,
    });
  }

  defaultSimulationPolicies(): { readonly compensation: CompensationPolicy; readonly pricing: PricingPolicy } {
    const compensation = simulationCompensationPolicyV1();
    const pricing = simulationPricingPolicyV1();
    this.store.policies.set(compensation.policyId, compensation);
    this.store.pricing.set(pricing.policyId, pricing);
    return { compensation, pricing };
  }

  private recordUsage(input: {
    readonly license: InformationLicense;
    readonly accessKind: AccessKind;
    readonly volume: number;
  }): Result<UsageEvent, RightsMarketplaceFailure> {
    const prior = [...this.store.usage.values()].filter((row) => row.licenseId === input.license.licenseId).length;
    if (prior >= input.license.queryLimit) {
      return err({ code: 'QUERY_LIMIT', message: 'license query limit reached' });
    }
    const event: UsageEvent = Object.freeze({
      usageId: newUsageEventId(),
      licenseId: input.license.licenseId,
      licenseeId: input.license.licenseeId,
      productId: input.license.productId,
      accessKind: input.accessKind,
      purpose: input.license.purpose,
      volume: input.volume,
      usageCount: prior + 1,
      billingReference: `bill:${input.license.licenseId}:${prior + 1}`,
      occurredAt: this.now(),
      rawQueryOutput: false,
      rawSensitivePayload: false,
    });
    this.store.usage.set(event.usageId, event);
    this.seal('usage.metered', {
      usageId: event.usageId,
      licenseId: event.licenseId,
      purpose: event.purpose,
      volume: event.volume,
    });
    return ok(event);
  }

  private expireIfNeeded(license: InformationLicense, force = false): InformationLicense {
    if (license.status !== 'ACTIVE') return license;
    if (!force && (!license.expiresAt || license.expiresAt > this.now())) return license;
    if (!canTransitionLicense(license.status, 'EXPIRED')) return license;
    const expired = Object.freeze({ ...license, status: 'EXPIRED' as const });
    this.store.licenses.set(expired.licenseId, expired);
    return expired;
  }

  private now(): UtcInstant {
    return this.clock.now();
  }

  private emit(eventType: string, aggregateId: string, payload: Record<string, unknown>): void {
    this.events?.append({
      eventType: eventType as never,
      schemaVersion: 1,
      occurredAt: this.now(),
      aggregateType: 'information_rights_marketplace',
      aggregateId,
      payload,
    });
  }

  private seal(kind: string, payload: Record<string, unknown>): void {
    this.evidence?.seal(`${EVIDENCE_KIND_RIGHTS_MARKETPLACE}:${kind}`, {
      ...payload,
      kind,
      simulation: true,
      rawDatabaseAccess: RAW_DATABASE_ACCESS,
    });
  }
}

function addDays(now: UtcInstant, days: number): UtcInstant {
  return new Date(Date.parse(now) + days * 86_400_000).toISOString() as UtcInstant;
}

function hashRef(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function refuseAuctionPricing(): RightsMarketplaceFailure {
  return { code: 'AUCTION_UNSUPPORTED', message: 'existing architecture does not support auction pricing' };
}
