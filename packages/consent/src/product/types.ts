import type { UtcInstant } from '../../../domain/src/time.ts';
import type { VerifiedActorContext } from '../../../identity/src/actor-context.ts';
import type { DataCategory, SensitivityClass } from '../../../personal-data-vault/src/taxonomy.ts';
import type { ConsentOperation, ConsentReasonCode } from '../taxonomy.ts';
import type {
  AccessAuditId,
  DelegationId,
  HinParticipationId,
  LicenseGrantId,
  ProductGrantId,
  RightsRequestId,
} from './ids.ts';
import type { ProductPurpose } from './purposes.ts';
import type {
  AccessActorKind,
  AccessDecisionOutcome,
  DelegationRelationship,
  EconomicUseClass,
  HinParticipationState,
  LicenseeClass,
  NecessityClass,
  PermissionBundleId,
  ProductConsentStatus,
  RightsRequestState,
  RightsRequestType,
} from './taxonomy.ts';

export type DataRightsFailure = {
  readonly code: ConsentReasonCode | 'IMPLICIT_OPT_IN_FORBIDDEN' | 'BUNDLE_UNKNOWN' | 'RIGHT_NOT_APPLICABLE' | 'DELEGATION_TOO_BROAD' | 'HIN_STATE_INVALID' | 'TERMS_REQUIRE_NEW_CONSENT' | 'LICENSE_DENIED';
  readonly message: string;
};

export type DataRightsActor = {
  readonly actorId: string;
  readonly subjectId: string;
  readonly jurisdiction?: string;
  readonly verified?: VerifiedActorContext;
  readonly originatedFromAgent?: boolean;
  readonly stepUpSatisfied?: boolean;
  readonly capabilities?: readonly string[];
};

export type ConsentGrantView = {
  readonly grantId: ProductGrantId;
  readonly consentId: string;
  readonly receiptId: string | null;
  readonly subjectId: string;
  readonly purposeId: string;
  readonly purpose: string;
  readonly ledgerCode: string;
  readonly purposeVersion: string;
  readonly dataCategories: readonly DataCategory[];
  readonly recipientClass: LicenseeClass;
  readonly recipientId: string;
  readonly scope: {
    readonly operations: readonly ConsentOperation[];
    readonly assetIds: readonly string[];
    readonly windowFrom: UtcInstant | null;
    readonly windowTo: UtcInstant | null;
  };
  readonly grantedAt: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly revocable: boolean;
  readonly termsVersion: string;
  readonly status: ProductConsentStatus;
  readonly source: { readonly kind: 'SESSION' | 'API' | 'BUNDLE'; readonly sessionId: string | null };
  readonly necessity: NecessityClass;
  readonly economicUseClass: EconomicUseClass;
  readonly bundleId: PermissionBundleId | null;
  readonly evidenceRef: string;
};

export type ClientReceipt = {
  readonly receiptId: string;
  readonly consentId: string;
  readonly purposeId: string;
  readonly termsVersion: string;
  readonly timestamp: UtcInstant;
  readonly actorId: string;
  readonly scope: {
    readonly categories: readonly DataCategory[];
    readonly recipientClass: LicenseeClass;
    readonly operations: readonly ConsentOperation[];
  };
  readonly rawPayloadIncluded: false;
};

export type AccessDecisionRequest = {
  readonly actor: DataRightsActor;
  readonly subjectId: string;
  readonly category: DataCategory;
  readonly recordId?: string;
  readonly purposeId: string;
  readonly requestedOperation: ConsentOperation;
  readonly actorKind: AccessActorKind;
  readonly classification?: SensitivityClass;
  readonly retentionState?: 'ACTIVE' | 'DELETED' | 'RETAINED_BY_POLICY';
  readonly jurisdiction?: string;
  readonly licenseId?: string;
  readonly delegationId?: string;
  readonly agentMandate?: {
    readonly state: string;
    readonly assistScopes: readonly string[];
    readonly actionClasses: readonly string[];
  };
};

export type AccessDecisionResult = {
  readonly decision: AccessDecisionOutcome;
  readonly reasonCode: string;
  readonly reason: string;
  readonly purposeId: string;
  readonly category: DataCategory;
  readonly consentId: string | null;
  readonly mandateSatisfied: boolean | null;
  readonly consentSatisfied: boolean | null;
  readonly resourceRef: string | null;
};

export type AccessAuditRecord = {
  readonly auditId: AccessAuditId;
  readonly actorId: string;
  readonly subjectId: string;
  readonly purposeId: string;
  readonly category: DataCategory;
  readonly timestamp: UtcInstant;
  readonly decision: AccessDecisionOutcome;
  readonly resourceRef: string | null;
  readonly rawValueLogged: false;
};

export type DataRightsRequest = {
  readonly requestId: RightsRequestId;
  readonly subjectId: string;
  readonly type: RightsRequestType;
  readonly state: RightsRequestState;
  readonly jurisdiction: string;
  readonly applicable: boolean;
  readonly rationale: string;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly evidenceRef: string;
};

export type HinParticipationRecord = {
  readonly participationId: HinParticipationId;
  readonly subjectId: string;
  readonly state: HinParticipationState;
  readonly eligibleCategories: readonly DataCategory[];
  readonly eligiblePurposeIds: readonly string[];
  readonly financialServicesRemainOpen: true;
  readonly updatedAt: UtcInstant;
};

export type LicenseGrant = {
  readonly licenseId: LicenseGrantId;
  readonly subjectId: string;
  readonly licenseeId: string;
  readonly licenseeClass: 'APPROVED_LICENSEE';
  readonly purposeId: string;
  readonly categories: readonly DataCategory[];
  readonly queryLimit: number;
  readonly queriesUsed: number;
  readonly windowFrom: UtcInstant;
  readonly windowTo: UtcInstant;
  readonly privacyRequirements: readonly string[];
  readonly termsVersion: string;
  readonly status: ProductConsentStatus;
  readonly unrestrictedDatabaseAccess: false;
};

export type DelegationRecord = {
  readonly delegationId: DelegationId;
  readonly subjectId: string;
  readonly delegateActorId: string;
  readonly relationship: DelegationRelationship;
  readonly categories: readonly DataCategory[];
  readonly purposeIds: readonly string[];
  readonly operations: readonly ConsentOperation[];
  readonly explicitSensitive: boolean;
  readonly status: ProductConsentStatus;
  readonly createdAt: UtcInstant;
};

export type RevocationWorkflow = {
  readonly consentId: string;
  readonly disabledAccess: true;
  readonly invalidatedPermissions: true;
  readonly licensingStopped: boolean;
  readonly agentAccessUpdated: boolean;
  readonly hinEligibilityUpdated: boolean;
  readonly notifiedSystems: readonly string[];
  readonly historicalProcessingErased: false;
};

export type PermissionCatalog = {
  readonly schema: 'sunrey.consumer.data.permissions.v1';
  readonly termsVersion: string;
  readonly implicitMonetizationOptIn: false;
  readonly purposes: readonly (ProductPurpose & { readonly granted: boolean; readonly consentId: string | null })[];
  readonly bundles: readonly {
    readonly bundleId: PermissionBundleId;
    readonly label: string;
    readonly description: string;
    readonly purposeId: string;
    readonly categories: readonly DataCategory[];
    readonly necessity: NecessityClass;
    readonly granted: boolean;
  }[];
};

export type WhoCanUseView = {
  readonly schema: 'sunrey.consumer.data.who.v1';
  readonly items: readonly {
    readonly recipientClass: LicenseeClass;
    readonly label: string;
    readonly purposeIds: readonly string[];
    readonly status: ProductConsentStatus | 'NONE';
  }[];
};
