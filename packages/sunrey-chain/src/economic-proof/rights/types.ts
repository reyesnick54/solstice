import type { UtcInstant } from '../../../../domain/src/time.ts';
import type {
  ConsentGrantId,
  LicenseAuthorizationId,
  PurposeAuthorizationId,
  RightsCommitmentId,
  RightsDeltaId,
  RightsGrantId,
  RightsRevocationId,
} from './ids.ts';
import type {
  LicenseRestrictionLevel,
  PurposeAuthorizationCode,
  RightsEconomyKind,
  RightsEvaluationDecision,
  RightsGrantState,
  RightsSchemaVersion,
} from './taxonomy.ts';

export type DelegationConstraints = {
  readonly delegable: false;
  readonly maxSubdelegates: 0;
  readonly notes: string | null;
};

export type RightsGrant = {
  readonly schemaVersion: RightsSchemaVersion;
  readonly rightsGrantId: RightsGrantId;
  readonly economyKind: RightsEconomyKind;
  readonly subjectCommitment: string;
  readonly controllerRef: string;
  readonly dataScopeCommitment: string;
  readonly evidenceScopeCommitment: string;
  readonly permittedPurposes: readonly PurposeAuthorizationId[];
  readonly prohibitedPurposes: readonly PurposeAuthorizationId[];
  readonly jurisdiction: string;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveUntil: UtcInstant | null;
  readonly revocationRef: RightsRevocationId | null;
  readonly delegation: DelegationConstraints;
  readonly issuerRef: string;
  readonly authorizationRef: string;
  readonly authorizesMonetaryIssuance: false;
  readonly authorizesEconomicValuation: false;
};

/**
 * Human Economy consent is distinct from economic valuation and issuance.
 * Consent proves permission to use data for a bounded purpose — not coin quantity.
 */
export type ConsentGrant = {
  readonly schemaVersion: RightsSchemaVersion;
  readonly consentGrantId: ConsentGrantId;
  readonly rightsGrantId: RightsGrantId;
  readonly authorizerRef: string;
  readonly contributionCategory: string;
  readonly dataCategoryCommitment: string;
  readonly purposeId: PurposeAuthorizationId;
  readonly scopeCommitment: string;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveUntil: UtcInstant | null;
  readonly revocationRef: RightsRevocationId | null;
  readonly proofRef: string;
  readonly authorizesMonetaryIssuance: false;
  readonly authorizesEconomicValuation: false;
};

export type PurposeAuthorization = {
  readonly schemaVersion: RightsSchemaVersion;
  readonly purposeId: PurposeAuthorizationId;
  readonly purposeVersion: number;
  readonly code: PurposeAuthorizationCode;
  readonly description: string;
};

/**
 * Productive Economy licensing is modeled separately from human consent.
 * Restrictions are taken from provider configuration — never inferred.
 */
export type LicenseAuthorization = {
  readonly schemaVersion: RightsSchemaVersion;
  readonly licenseId: LicenseAuthorizationId;
  readonly providerRef: string;
  readonly sourceScopeCommitment: string;
  readonly commercialUse: LicenseRestrictionLevel;
  readonly persistence: LicenseRestrictionLevel;
  readonly derivedUse: LicenseRestrictionLevel;
  readonly redistribution: LicenseRestrictionLevel;
  readonly attributionRequired: boolean;
  readonly effectiveFrom: UtcInstant;
  readonly expiresAt: UtcInstant | null;
  readonly configurationRef: string;
  readonly authorizesMonetaryIssuance: false;
};

export type RightsCommitment = {
  readonly schemaVersion: RightsSchemaVersion;
  readonly commitmentId: RightsCommitmentId;
  readonly rightsGrantCommitment: string;
  readonly consentGrantCommitment: string | null;
  readonly licenseAuthorizationCommitment: string | null;
  readonly purposeId: PurposeAuthorizationId;
  readonly jurisdiction: string;
  readonly evaluatedAt: UtcInstant;
  readonly economyKind: RightsEconomyKind;
};

export type RightsDelta = {
  readonly schemaVersion: RightsSchemaVersion;
  readonly deltaId: RightsDeltaId;
  readonly sequence: number;
  readonly commitment: string;
  readonly occurredAt: UtcInstant;
};

export type RightsRevocation = {
  readonly schemaVersion: RightsSchemaVersion;
  readonly revocationId: RightsRevocationId;
  readonly targetGrantId: RightsGrantId | ConsentGrantId;
  readonly targetKind: 'RIGHTS_GRANT' | 'CONSENT_GRANT';
  readonly revokedAt: UtcInstant;
  readonly reason: string;
  readonly effectiveForFutureUse: true;
  readonly preservesHistoricalProof: true;
};

export type RightsDenialCode =
  | 'RIGHTS_MISSING'
  | 'CONSENT_MISSING'
  | 'CONSENT_REQUIRED'
  | 'LICENSE_MISSING'
  | 'LICENSE_REQUIRED'
  | 'PURPOSE_NOT_PERMITTED'
  | 'PURPOSE_PROHIBITED'
  | 'RIGHTS_EXPIRED'
  | 'CONSENT_EXPIRED'
  | 'LICENSE_EXPIRED'
  | 'RIGHTS_REVOKED'
  | 'CONSENT_REVOKED'
  | 'LICENSE_RESTRICTION'
  | 'JURISDICTION_UNRESOLVED'
  | 'SUBJECT_MISMATCH'
  | 'CONSENT_DOES_NOT_AUTHORIZE_ISSUANCE'
  | 'CONSENT_DOES_NOT_AUTHORIZE_VALUATION';

export type RightsEvaluationRequest = {
  readonly rightsGrant: RightsGrant;
  readonly consentGrant?: ConsentGrant;
  readonly licenseAuthorization?: LicenseAuthorization;
  readonly requestedPurpose: PurposeAuthorization;
  readonly at: UtcInstant;
  readonly contributionClass?: string;
  readonly revocations?: readonly RightsRevocation[];
  readonly historicalEvaluation?: boolean;
  readonly licenseOperation?: 'COMMERCIAL_USE' | 'PERSISTENCE' | 'DERIVED_USE' | 'REDISTRIBUTION';
};

export type RightsEvaluationAllow = {
  readonly decision: Extract<RightsEvaluationDecision, 'ALLOW'>;
  readonly commitment: RightsCommitment;
  readonly grantStateAtEvaluation: RightsGrantState;
  readonly reliedUpon: {
    readonly rightsGrantId: RightsGrantId;
    readonly consentGrantId: ConsentGrantId | null;
    readonly licenseId: LicenseAuthorizationId | null;
    readonly purposeId: PurposeAuthorizationId;
    readonly revocationRef: RightsRevocationId | null;
  };
};

export type RightsEvaluationDeny = {
  readonly decision: Extract<RightsEvaluationDecision, 'DENY'>;
  readonly reasonCode: RightsDenialCode;
  readonly message: string;
};

export type RightsEvaluationResult = RightsEvaluationAllow | RightsEvaluationDeny;

export type HistoricalRightsProof = {
  readonly evaluatedAt: UtcInstant;
  readonly commitment: RightsCommitment;
  readonly reliedUponRevocationRef: RightsRevocationId | null;
  readonly validAtExecutionTime: true;
  readonly blockedForFutureUse: boolean;
};
